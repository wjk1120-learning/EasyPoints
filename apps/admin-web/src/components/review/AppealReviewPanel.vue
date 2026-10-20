<script setup lang="ts">
/**
 * 申诉处理面板（PRD 5.2 / 3.3）：嵌入审核中心 Tab。
 * 一级三态闭环：仅待审核可处理；处理后工单闭环不可重复申诉。
 */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { appealsPaged, reviewAppeal } from "../../api/appeal/appeal";
import type { Appeal } from "../../api/appeal/types";
import { employees as fetchEmployees } from "../../api/employee/employee";
import type { Employee } from "../../api/employee/types";
import { APPEAL_STATUS_MAP, statusMeta } from "../../utils/status";
import { formatTimeText } from "../../utils/format";
import { pendingFirst } from "../../utils/sort";
import WorkOrderDetail from "../WorkOrderDetail.vue";
import { signedPoints } from "../../utils/points";
import type { WorkOrderField } from "../WorkOrderDetail.vue";
import { apiErrorMsg } from "../../utils/error";

const rows = ref<Appeal[]>([]);
const loading = ref(false);
const meta = reactive({ total: 0, page: 1, pageSize: 50 });
const employees = ref<Employee[]>([]);
const query = reactive({ status: "", employeeId: "" });

const processing = ref(false);
const dialogVisible = ref(false);
const selectedRow = ref<Appeal | null>(null);
const form = reactive({ decision: "approved" as "approved" | "rejected", remark: "" });
const detailDialog = reactive({ visible: false, fields: [] as WorkOrderField[] });

const employeeNameMap = computed(() => {
  const map = new Map<string, string>();
  for (const item of employees.value) map.set(String(item.id), item.name);
  return map;
});

function formatEmployee(row: Appeal) {
  if (row?.employeeName) return row.employeeName;
  if (row?.employeeId != null) return employeeNameMap.value.get(String(row.employeeId)) || String(row.employeeId);
  return "";
}

const statusText = (value: string) => statusMeta(APPEAL_STATUS_MAP, value).text;
const statusTag = (value: string) => statusMeta(APPEAL_STATUS_MAP, value).tag;
/** 仅待审核可处理（7.4 一级审核：处理后工单闭环；兼容旧 pending_ 前缀值） */
const isPending = (value: string) => String(value || "").startsWith("pending_");

/** 佐证图解析（7.3：JSON 字符串原样输出；已为数组时直用，解析失败按空处理） */
function evidenceImagesOf(row: Appeal): string[] {
  const raw = row?.evidenceImages;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 被申诉事件摘要：流水目标用流水备注+分值，其余目标用 targetSummary（7.3 审核上下文） */
function formatEvent(row: Appeal) {
  const record = row?.pointRecord;
  if (record) {
    const delta = Number(record.pointsDelta || 0);
    const deltaText = `${delta > 0 ? "+" : ""}${delta}`;
    const remark = String(record.remark || "").trim();
    if (!remark) return deltaText;
    return `${remark}（${deltaText}）`;
  }
  const summary = row?.targetSummary;
  if (summary?.title) return summary.content ? `${summary.title} · ${summary.content}` : summary.title;
  return row?.pointRecordId != null ? String(row.pointRecordId) : "";
}

async function load() {
  loading.value = true;
  try {
    const result = await appealsPaged({
      page: meta.page,
      pageSize: meta.pageSize,
      status: query.status,
      employeeId: query.employeeId
    });
    rows.value = pendingFirst(result.data, (row) => String(row.status || "").startsWith("pending_"), (row) =>
      new Date(row.updatedAt || row.createdAt || 0).getTime()
    );
    meta.total = result.meta.total;
  } catch (error) {
    ElMessage.error(apiErrorMsg(error, "加载申诉列表失败"));
  } finally {
    loading.value = false;
  }
}

function openProcess(row: Appeal) {
  selectedRow.value = row;
  form.decision = "approved";
  form.remark = "";
  dialogVisible.value = true;
}

/** 只读详情：全程留痕 + 被申诉原记录上下文（7.3 targetSummary，任务/申请/订单类申诉不再盲审） */
function openDetail(row: Appeal) {
  const summary = row.targetSummary;
  detailDialog.fields = [
    { label: "申诉人", value: formatEmployee(row) },
    { label: "申诉目标", value: summary?.title || (row.pointRecordId != null ? `积分流水 #${row.pointRecordId}` : "—") },
    { label: "原记录内容", value: summary?.content || row.pointRecord?.remark || "—" },
    // 当时审核备注：仅任务/申请/订单类申诉有（流水类契约即为 null）；过渡期旧后端不返回 targetSummary 时给占位说明
    ...(summary
      ? summary.reviewRemark
        ? [{ label: "当时审核备注", value: summary.reviewRemark }]
        : []
      : row.targetType && row.targetType !== "point_record"
        ? [{ label: "当时审核备注", value: "当前后端未返回（新后端接入后可见）" }]
        : []),
    { label: "申诉原因", value: row.reason },
    ...(row.pointRecord ? [{ label: "关联流水分值", value: signedPoints(row.pointRecord.pointsDelta), type: "delta" as const }] : []),
    { label: "佐证材料", type: "images" as const, images: evidenceImagesOf(row) },
    { label: "申诉时间", value: row.createdAt, type: "time" },
    { label: "当前状态", value: row.statusText || statusText(row.status) },
    { label: "处理备注", value: row.resultRemark || row.resolution || "—" },
    { label: "更新时间", value: row.updatedAt, type: "time" }
  ];
  detailDialog.visible = true;
}

function closeDialog() {
  dialogVisible.value = false;
  selectedRow.value = null;
  form.decision = "approved";
  form.remark = "";
}

async function submitProcess() {
  const remark = String(form.remark || "").trim();
  if (!remark) {
    ElMessage.warning("请填写处理备注");
    return;
  }
  if (!selectedRow.value) return;
  processing.value = true;
  try {
    // 7.4 一级三态审核（无 stage）：通过且目标为未冲正扣分流水时后端同事务自动补分
    await reviewAppeal(selectedRow.value.id, {
      status: form.decision,
      resultRemark: remark
    });
    ElMessage.success(form.decision === "rejected" ? "申诉审核已驳回，结果将推送员工" : "申诉审核已通过");
    window.dispatchEvent(new CustomEvent("review:refresh"));
    window.dispatchEvent(new CustomEvent("badges:refresh"));
    closeDialog();
    if (meta.page > 1 && rows.value.length <= 1) meta.page = 1;
    await load();
  } catch (error) {
    ElMessage.error(apiErrorMsg(error, "申诉处理失败"));
  } finally {
    processing.value = false;
  }
}

onMounted(async () => {
  employees.value = await fetchEmployees();
  await load();
});

watch(
  () => [query.status, query.employeeId, meta.pageSize],
  () => {
    meta.page = 1;
    load();
  }
);
</script>

<template>
  <div class="review-panel">
    <div class="filter-bar">
      <el-select v-model="query.status" clearable placeholder="状态" class="filter-item">
        <el-option value="" label="全部" />
        <el-option value="pending_review" label="待审核" />
        <el-option value="approved" label="审核通过" />
        <el-option value="rejected" label="已驳回" />
      </el-select>
      <el-select v-model="query.employeeId" clearable placeholder="员工" class="filter-item">
        <el-option v-for="item in employees" :key="item.id" :label="item.name" :value="String(item.id)" />
      </el-select>
      <el-select v-model="meta.pageSize" placeholder="每页" class="filter-item filter-item--sm">
        <el-option :value="20" label="20 / 页" />
        <el-option :value="50" label="50 / 页" />
        <el-option :value="100" label="100 / 页" />
      </el-select>
    </div>

    <el-table :data="rows" border v-loading="loading">
      <el-table-column label="员工" width="140">
        <template #default="{ row }">{{ formatEmployee(row) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)" effect="plain">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="申诉原因" min-width="200" show-overflow-tooltip />
      <el-table-column label="事件" width="240">
        <template #default="{ row }">{{ formatEvent(row) }}</template>
      </el-table-column>
      <el-table-column label="处理备注" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.resultRemark || "—" }}</template>
      </el-table-column>
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ formatTimeText(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button v-if="isPending(row.status)" size="small" type="primary" @click="openProcess(row)">处理</el-button>
          <el-button size="small" @click="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-bar">
      <el-pagination
        background
        layout="total, prev, pager, next, jumper"
        :total="meta.total"
        :page-size="meta.pageSize"
        :current-page="meta.page"
        @current-change="
          (p: number) => {
            meta.page = p;
            load();
          }
        "
      />
    </div>
  </div>

  <el-dialog v-model="dialogVisible" title="处理申诉" width="520px" @close="closeDialog">
    <el-form label-width="90px">
      <el-form-item label="处理结果">
        <el-radio-group v-model="form.decision">
          <el-radio label="approved">通过</el-radio>
          <el-radio label="rejected">驳回</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="处理备注" required>
        <el-input v-model="form.remark" type="textarea" :rows="4" placeholder="必须填写处理备注" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="processing" @click="submitProcess">提交</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="detailDialog.visible" title="申诉工单详情" width="560px">
    <WorkOrderDetail :fields="detailDialog.fields" />
  </el-dialog>
</template>

<style scoped lang="scss">
.review-panel {
  padding: 4px 2px 8px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.filter-item {
  width: 220px;
}

.filter-item--sm {
  width: 120px;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
