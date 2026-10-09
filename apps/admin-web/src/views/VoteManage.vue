<script setup lang="ts">
/**
 * 投票管理（PRD 5.9）：新建/编辑投票、手动关闭、统计查看、统计导出。
 * 重要约束（PRD 3.4 第 7 条）：投票仅作审核参考，不自动生成积分、不自动完成审核。
 */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowDown, ArrowUp, Delete, Plus } from "@element-plus/icons-vue";
import {
  closeVote,
  createVote,
  updateVote,
  voteStats,
  votesPaged,
} from "../api/vote/vote";
import type { Vote, VotePayload, VoteStats } from "../api/vote/vote";
import { mockLogVoteExported } from "../mock/vote";
import { employees as fetchEmployees } from "../api/employee/employee";
import type { Employee } from "../api/employee/types";
import { tasksPaged } from "../api/task/task";
import { applicationsPaged } from "../api/application/application";
import { VOTE_STATUS_MAP, statusMeta } from "../utils/status";
import { buildVoteStatsCsv, deriveVoteStatus, validateVotePayload } from "../utils/vote";
import { formatTimeText } from "../utils/format";
import { saveBlob } from "../utils/request";
import { createSubmitLock } from "../utils/submit-lock";

const rows = ref<Vote[]>([]);
const loading = ref(false);
const filter = reactive({ title: "", status: "" });
const saveLock = createSubmitLock();
const actionLock = createSubmitLock();
const actingId = ref<number | null>(null);

const statusText = (vote: Vote) => statusMeta(VOTE_STATUS_MAP, deriveVoteStatus(vote)).text;
const statusTag = (vote: Vote) => statusMeta(VOTE_STATUS_MAP, deriveVoteStatus(vote)).tag;

async function load() {
  loading.value = true;
  try {
    const result = await votesPaged({ page: 1, pageSize: 200, title: filter.title, status: filter.status });
    rows.value = result.data;
  } catch (error) {
    ElMessage.error((error as Error)?.message || "加载投票列表失败");
  } finally {
    loading.value = false;
  }
}

watch(
  () => [filter.title, filter.status],
  () => load()
);

// ==============================
// 新建 / 编辑弹窗
// ==============================
const dialog = reactive({ visible: false, editId: null as number | null, submitting: false });
const form = reactive({
  title: "",
  description: "",
  relatedValue: "",
  voteType: "single" as "single" | "multiple",
  startTime: "",
  endTime: ""
});
const optionTexts = ref<string[]>(["", ""]);
const participantIds = ref<number[]>([]);

const employees = ref<Employee[]>([]);
const participantKeyword = ref("");
const participantDepartment = ref<number | string>("");

const departmentOptions = computed(() => {
  const seen = new Map<number, string>();
  for (const item of employees.value) {
    if (item.departmentId != null && !seen.has(item.departmentId)) {
      seen.set(item.departmentId, item.departmentName || `部门(${item.departmentId})`);
    }
  }
  return [...seen.entries()].map(([departmentId, name]) => ({ departmentId, name }));
});

const participantPool = computed(() => {
  const keyword = participantKeyword.value.trim().toLowerCase();
  return employees.value.filter((item) => {
    if (participantDepartment.value && String(item.departmentId) !== String(participantDepartment.value)) return false;
    if (keyword && !String(item.name || "").toLowerCase().includes(keyword)) return false;
    return true;
  });
});

/** 关联业务候选项：任务 + 积分申请工单（PRD 5.9.1 第 3 条） */
const relatedOptions = ref<{ value: string; label: string }[]>([]);
const relatedKeyword = ref("");

async function loadRelatedOptions() {
  const [tasksResult, applicationsResult] = await Promise.all([
    tasksPaged({ page: 1, pageSize: 100 }).catch(() => ({ data: [] })),
    applicationsPaged({ page: 1, pageSize: 100 }).catch(() => ({ data: [] }))
  ]);
  const options: { value: string; label: string }[] = [];
  for (const task of tasksResult.data) {
    options.push({ value: `task:${task.id}`, label: `任务：${task.name}` });
  }
  for (const application of applicationsResult.data) {
    options.push({ value: `application:${application.id}`, label: `积分申请：${application.employeeName || `员工(${application.employeeId})`} +${application.points}分` });
  }
  relatedOptions.value = options;
}

const relatedLabelOf = (value: string) => relatedOptions.value.find((option) => option.value === value)?.label || "";

function openCreate() {
  dialog.editId = null;
  form.title = "";
  form.description = "";
  form.relatedValue = "";
  form.voteType = "single";
  form.startTime = "";
  form.endTime = "";
  optionTexts.value = ["", ""];
  participantIds.value = [];
  relatedKeyword.value = "";
  participantKeyword.value = "";
  participantDepartment.value = "";
  dialog.visible = true;
}

function openEdit(row: Vote) {
  dialog.editId = row.id;
  form.title = row.title;
  form.description = row.description;
  form.relatedValue = row.relatedType ? `${row.relatedType}:${row.relatedId}` : "";
  form.voteType = row.voteType === "multiple" ? "multiple" : "single";
  form.startTime = row.startTime;
  form.endTime = row.endTime;
  optionTexts.value = row.options.map((option) => option.text);
  participantIds.value = [...row.participantIds];
  relatedKeyword.value = "";
  participantKeyword.value = "";
  participantDepartment.value = "";
  dialog.visible = true;
}

function addOption() {
  optionTexts.value.push("");
}

function removeOption(index: number) {
  if (optionTexts.value.length <= 2) {
    ElMessage.warning("至少保留 2 个投票选项");
    return;
  }
  optionTexts.value.splice(index, 1);
}

function moveOption(index: number, offset: -1 | 1) {
  const target = index + offset;
  if (target < 0 || target >= optionTexts.value.length) return;
  const texts = [...optionTexts.value];
  [texts[index], texts[target]] = [texts[target], texts[index]];
  optionTexts.value = texts;
}

function toggleParticipant(id: number, checked: boolean) {
  const set = new Set(participantIds.value);
  if (checked) set.add(id);
  else set.delete(id);
  participantIds.value = [...set];
}

async function save() {
  const [relatedType, relatedId] = parseRelated(form.relatedValue);
  const payload: VotePayload = {
    title: String(form.title || "").trim(),
    description: String(form.description || "").trim(),
    relatedType,
    relatedId,
    relatedLabel: relatedLabelOf(form.relatedValue),
    voteType: form.voteType,
    options: optionTexts.value.map((text) => text.trim()).filter(Boolean),
    startTime: form.startTime,
    endTime: form.endTime,
    participantIds: participantIds.value,
    participantNames: participantIds.value.map((id) => employees.value.find((item) => item.id === id)?.name || `员工(${id})`)
  };
  const error = validateVotePayload(payload);
  if (error) {
    ElMessage.warning(error);
    return;
  }
  if (!saveLock.acquire()) return;
  dialog.submitting = true;
  try {
    if (dialog.editId) {
      await updateVote(dialog.editId, payload);
      ElMessage.success("投票已更新");
    } else {
      await createVote(payload);
      ElMessage.success("投票已创建，到开始时间将自动推送参与员工");
    }
    dialog.visible = false;
    await load();
  } catch (error) {
    ElMessage.error((error as Error)?.message || "保存失败");
  } finally {
    dialog.submitting = false;
    saveLock.release();
  }
}

function parseRelated(value: string): ["" | "task" | "application", number | undefined] {
  if (!value) return ["", undefined];
  const [type, id] = value.split(":");
  return [type as "task" | "application", Number(id)];
}

// ==============================
// 手动关闭
// ==============================
async function close(row: Vote) {
  try {
    await ElMessageBox.confirm(
      `确认关闭投票「${row.title}」？关闭后员工不可再提交，状态变为已结束。`,
      "关闭投票",
      { type: "warning", confirmButtonText: "确认关闭", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  if (!actionLock.acquire()) return;
  actingId.value = row.id;
  try {
    await closeVote(row.id);
    ElMessage.success("投票已关闭");
    await load();
  } catch (error) {
    ElMessage.error((error as Error)?.message || "关闭失败");
  } finally {
    actingId.value = null;
    actionLock.release();
  }
}

// ==============================
// 统计抽屉
// ==============================
const statsDrawer = reactive({ visible: false, loading: false, vote: null as Vote | null, stats: null as VoteStats | null });
const exporting = ref(false);

const canViewStats = (vote: Vote) => deriveVoteStatus(vote) !== "not_started";
const canClose = (vote: Vote) => deriveVoteStatus(vote) !== "ended";

async function openStats(row: Vote) {
  statsDrawer.vote = row;
  statsDrawer.visible = true;
  statsDrawer.loading = true;
  try {
    statsDrawer.stats = await voteStats(row.id);
  } catch (error) {
    ElMessage.error((error as Error)?.message || "加载统计失败");
    statsDrawer.visible = false;
  } finally {
    statsDrawer.loading = false;
  }
}

function exportStats() {
  if (!statsDrawer.vote || !statsDrawer.stats) return;
  exporting.value = true;
  try {
    const csv = buildVoteStatsCsv(statsDrawer.vote, statsDrawer.stats);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const stamp = new Date().toISOString().slice(0, 10);
    saveBlob(blob, `vote-stats-${statsDrawer.vote.title}-${stamp}.csv`);
    // 导出行为写「投票操作日志」（PRD 5.9.3；mock 阶段由前端记录，后端就绪后由导出接口记录）
    mockLogVoteExported(statsDrawer.vote.id);
    ElMessage.success("统计已导出（当前为 CSV 兜底，后端就绪后切换 Excel 接口）");
  } finally {
    exporting.value = false;
  }
}

onMounted(async () => {
  await load();
  employees.value = await fetchEmployees().catch(() => []);
  await loadRelatedOptions();
});
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <span class="panel-bar" />
      <h3 class="panel-title">投票管理</h3>
      <div class="panel-head-extra">
        <span class="panel-hint">投票仅作审核参考，不会自动生成积分或完成审核</span>
        <el-button color="var(--color-primary)" @click="openCreate">新建投票</el-button>
      </div>
    </div>

    <div class="panel-body">
      <div class="filter-bar">
        <el-input v-model="filter.title" placeholder="按标题搜索" clearable class="filter-item" />
        <el-select v-model="filter.status" clearable placeholder="状态" class="filter-item filter-item--md">
          <el-option value="" label="全部" />
          <el-option value="not_started" label="未开始" />
          <el-option value="in_progress" label="进行中" />
          <el-option value="ended" label="已结束" />
        </el-select>
      </div>

      <el-table :data="rows" border v-loading="loading">
        <el-table-column prop="title" label="投票标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="关联业务" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.relatedLabel || "普通调研" }}</template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.voteType === 'single' ? 'primary' : 'success'" effect="plain" size="small">
              {{ row.voteType === "single" ? "单选" : "多选" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row)" effect="plain">{{ statusText(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="投票时间" width="320">
          <template #default="{ row }">
            {{ formatTimeText(row.startTime).slice(0, 16) }} ~ {{ formatTimeText(row.endTime).slice(0, 16) }}
          </template>
        </el-table-column>
        <el-table-column label="参与人数" width="100">
          <template #default="{ row }">{{ row.submittedCount ?? 0 }}/{{ row.participantIds.length }}</template>
        </el-table-column>
        <el-table-column prop="createdBy" label="创建人" width="120" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" plain :disabled="!canViewStats(row)" @click="openStats(row)">统计</el-button>
            <el-button v-if="deriveVoteStatus(row) === 'not_started'" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="canClose(row)" size="small" type="danger" plain :loading="actingId === row.id" @click="close(row)">关闭</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>

  <!-- 新建 / 编辑投票 -->
  <el-dialog v-model="dialog.visible" :title="dialog.editId ? '编辑投票' : '新建投票'" width="720px" top="6vh">
    <el-form label-width="100px">
      <el-form-item label="投票标题" required>
        <el-input v-model="form.title" maxlength="50" show-word-limit placeholder="例如：XX员工任务贡献分值评审投票" />
      </el-form-item>
      <el-form-item label="投票描述">
        <el-input v-model="form.description" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="补充说明投票背景（选填）" />
      </el-form-item>
      <el-form-item label="关联业务">
        <el-select v-model="form.relatedValue" clearable filterable placeholder="选择任务 / 积分申请工单（选填）" style="width: 100%">
          <el-option v-for="item in relatedOptions" :key="item.value" :value="item.value" :label="item.label" />
        </el-select>
      </el-form-item>
      <el-form-item label="投票类型" required>
        <el-radio-group v-model="form.voteType">
          <el-radio value="single">单选</el-radio>
          <el-radio value="multiple">多选</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="投票选项" required>
        <div class="option-editor">
          <div v-for="(text, index) in optionTexts" :key="index" class="option-row">
            <span class="option-index">{{ index + 1 }}</span>
            <el-input v-model="optionTexts[index]" maxlength="50" placeholder="选项内容，例如：A、100分" />
            <div class="option-actions">
              <el-button :icon="ArrowUp" size="small" circle :disabled="index === 0" @click="moveOption(index, -1)" />
              <el-button :icon="ArrowDown" size="small" circle :disabled="index === optionTexts.length - 1" @click="moveOption(index, 1)" />
              <el-button :icon="Delete" size="small" circle type="danger" plain :disabled="optionTexts.length <= 2" @click="removeOption(index)" />
            </div>
          </div>
          <el-button :icon="Plus" size="small" @click="addOption">添加选项</el-button>
        </div>
      </el-form-item>
      <el-form-item label="投票时间" required>
        <div class="time-range">
          <el-date-picker
            v-model="form.startTime"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm"
            format="YYYY-MM-DD HH:mm"
            placeholder="开始时间"
          />
          <span class="time-sep">至</span>
          <el-date-picker
            v-model="form.endTime"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm"
            format="YYYY-MM-DD HH:mm"
            placeholder="截止时间"
          />
        </div>
      </el-form-item>
      <el-form-item label="参与人员" required>
        <div class="participant-picker">
          <div class="participant-filters">
            <el-select v-model="participantDepartment" clearable placeholder="全部部门" style="width: 160px">
              <el-option v-for="item in departmentOptions" :key="item.departmentId" :label="item.name" :value="item.departmentId" />
            </el-select>
            <el-input v-model="participantKeyword" placeholder="搜索员工姓名" clearable style="width: 180px" />
            <span class="participant-count">已选 {{ participantIds.length }} 人</span>
          </div>
          <el-table
            :data="participantPool"
            border
            max-height="260"
            size="small"
            @select="(selection: Employee[], row: Employee) => toggleParticipant(row.id, selection.includes(row))"
            @select-all="(selection: Employee[]) => { participantPool.forEach((item) => toggleParticipant(item.id, selection.includes(item))) }"
          >
            <el-table-column type="selection" width="46" :selectable="() => true" />
            <el-table-column prop="name" label="姓名" width="120" />
            <el-table-column label="部门" min-width="140">
              <template #default="{ row }">{{ row.departmentName || `部门(${row.departmentId})` }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="dialog.submitting" @click="save">保存</el-button>
    </template>
  </el-dialog>

  <!-- 统计结果 -->
  <el-drawer v-model="statsDrawer.visible" size="30%" :title="`投票统计 · ${statsDrawer.vote?.title || ''}`">
    <div v-loading="statsDrawer.loading" class="stats-content">
      <template v-if="statsDrawer.stats">
        <div class="stats-overview">
          <div class="overview-item">
            <span class="overview-label">应参与人数</span>
            <strong class="overview-value">{{ statsDrawer.stats.totalParticipants }}</strong>
          </div>
          <div class="overview-item">
            <span class="overview-label">实际参与人数</span>
            <strong class="overview-value">{{ statsDrawer.stats.submittedCount }}</strong>
          </div>
          <div class="overview-item">
            <span class="overview-label">参与率</span>
            <strong class="overview-value overview-value--primary">{{ statsDrawer.stats.participationRate }}%</strong>
          </div>
        </div>

        <h4 class="stats-subtitle">选项统计</h4>
        <div class="option-stats">
          <div v-for="option in statsDrawer.stats.optionStats" :key="option.text" class="option-stat">
            <div class="option-stat-head">
              <span class="option-stat-text">{{ option.text }}</span>
              <span class="option-stat-num">{{ option.votes }} 票 · {{ option.percent }}%</span>
            </div>
            <el-progress :percentage="option.percent" :stroke-width="10" />
          </div>
        </div>

        <h4 class="stats-subtitle">投票明细</h4>
        <el-table :data="statsDrawer.stats.details" border size="small">
          <el-table-column prop="employeeName" label="员工" width="120" />
          <el-table-column label="所选选项" min-width="200">
            <template #default="{ row }">{{ row.selectedTexts.join("、") || "—" }}</template>
          </el-table-column>
          <el-table-column label="提交时间" width="180">
            <template #default="{ row }">{{ formatTimeText(row.submittedAt) }}</template>
          </el-table-column>
        </el-table>

        <div class="stats-footer">
          <el-button type="primary" :loading="exporting" @click="exportStats">导出统计（CSV）</el-button>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
.panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border);
}

.panel-head-extra {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-hint {
  font-size: 12px;
  color: var(--color-text-placeholder);
}

.panel-bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  background: var(--color-primary);
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.panel-body {
  padding: 20px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.filter-item {
  width: 240px;
}

.filter-item--md {
  width: 180px;
}

.option-editor {
  width: 100%;

  .option-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .option-index {
    width: 20px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .option-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
}

.time-range {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;

  .time-sep {
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }
}

.participant-picker {
  width: 100%;

  .participant-filters {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .participant-count {
    margin-left: auto;
    font-size: 13px;
    color: var(--color-primary);
    font-weight: 500;
  }
}

.stats-content {
  min-height: 200px;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;

  .overview-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    background: var(--color-bg-page);
    border-radius: 10px;
  }

  .overview-label {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .overview-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .overview-value--primary {
    color: var(--color-primary);
  }
}

.stats-subtitle {
  margin: 18px 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.option-stats {
  .option-stat {
    margin-bottom: 12px;
  }

  .option-stat-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 13px;

    .option-stat-text {
      color: var(--color-text-regular);
    }

    .option-stat-num {
      color: var(--color-text-secondary);
    }
  }
}

.stats-footer {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
}
</style>
