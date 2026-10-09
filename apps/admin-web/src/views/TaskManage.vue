<script setup lang="ts">
/**
 * 任务管理（PRD 5.5）：任务发布、编辑、上下架、删除、进度查看。
 * 任务成果的审核动作统一在「审核中心 → 任务审核」处理（PRD 5.2 单一审核入口）。
 */
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createTask,
  deleteTask,
  publishTask,
  taskRecordsPaged,
  tasksPaged,
  unpublishTask,
  updateTask,
} from "../api/task/task";
import type { EmployeeTask, Task, TaskPayload } from "../api/task/task";
import { TASK_RECORD_STATUS_MAP, TASK_STATUS_MAP, statusMeta } from "../utils/status";
import { formatTimeText } from "../utils/format";
import { createSubmitLock } from "../utils/submit-lock";

const rows = ref<Task[]>([]);
const loading = ref(false);
const saving = ref(false);
const actLock = createSubmitLock();
/** 正在操作的任务（行级防重复提交） */
const actingId = ref<number | null>(null);

const dialog = reactive({ visible: false, editId: null as number | null });
const form = reactive<TaskPayload>({
  name: "",
  description: "",
  rewardPoints: 50,
  deadline: "",
  requirement: ""
});

/** 进度抽屉 */
const progressDrawer = reactive({ visible: false, loading: false, task: null as Task | null, rows: [] as EmployeeTask[] });

const statusText = (value: string) => statusMeta(TASK_STATUS_MAP, value).text;
const statusTag = (value: string) => statusMeta(TASK_STATUS_MAP, value).tag;
const recordText = (value: string) => statusMeta(TASK_RECORD_STATUS_MAP, value).text;
const recordTag = (value: string) => statusMeta(TASK_RECORD_STATUS_MAP, value).tag;

async function load() {
  loading.value = true;
  try {
    const result = await tasksPaged({ page: 1, pageSize: 200 });
    rows.value = result.data;
  } catch (error) {
    ElMessage.error((error as Error)?.message || "加载任务失败");
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  dialog.editId = null;
  form.name = "";
  form.description = "";
  form.rewardPoints = 50;
  form.deadline = "";
  form.requirement = "";
}

function openCreate() {
  resetForm();
  dialog.visible = true;
}

function openEdit(row: Task) {
  dialog.editId = row.id;
  form.name = row.name;
  form.description = row.description;
  form.rewardPoints = Number(row.rewardPoints || 0);
  form.deadline = row.deadline;
  form.requirement = row.requirement;
  dialog.visible = true;
}

async function save() {
  const name = String(form.name || "").trim();
  if (!name) return ElMessage.warning("请填写任务名称");
  if (!Number.isFinite(Number(form.rewardPoints)) || Number(form.rewardPoints) <= 0) return ElMessage.warning("奖励积分必须大于 0");
  if (!form.deadline) return ElMessage.warning("请选择有效期");
  if (!String(form.requirement || "").trim()) return ElMessage.warning("请填写完成要求");

  saving.value = true;
  try {
    if (dialog.editId) {
      await updateTask(dialog.editId, { ...form, name });
      ElMessage.success("任务已更新");
    } else {
      await createTask({ ...form, name });
      ElMessage.success("任务已创建（默认下架，上架后员工端可见）");
    }
    dialog.visible = false;
    await load();
  } catch (error) {
    ElMessage.error((error as Error)?.message || "保存失败");
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(row: Task) {
  const publishing = row.status !== "published";
  try {
    await ElMessageBox.confirm(
      publishing
        ? `确认上架「${row.name}」？上架后员工端任务大厅可见。`
        : `确认下架「${row.name}」？下架后员工端隐藏，进行中记录保留。`,
      publishing ? "上架任务" : "下架任务",
      { type: "warning", confirmButtonText: "确认", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  if (!actLock.acquire()) return;
  actingId.value = row.id;
  try {
    if (publishing) await publishTask(row.id);
    else await unpublishTask(row.id);
    ElMessage.success(publishing ? "已上架" : "已下架");
    await load();
  } catch (error) {
    ElMessage.error((error as Error)?.message || "操作失败");
  } finally {
    actingId.value = null;
    actLock.release();
  }
}

async function remove(row: Task) {
  try {
    await ElMessageBox.confirm(
      `确认删除任务「${row.name}」？删除后不可恢复，员工领取记录将保留。`,
      "删除任务",
      { type: "warning", confirmButtonText: "确认删除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  if (!actLock.acquire()) return;
  actingId.value = row.id;
  try {
    await deleteTask(row.id);
    ElMessage.success("任务已删除");
    await load();
  } catch (error) {
    ElMessage.error((error as Error)?.message || "删除失败");
  } finally {
    actingId.value = null;
    actLock.release();
  }
}

/** 进度抽屉：该任务的员工领取/提交/审核记录（只读，审核去审核中心） */
async function openProgress(row: Task) {
  progressDrawer.task = row;
  progressDrawer.visible = true;
  progressDrawer.loading = true;
  try {
    const result = await taskRecordsPaged({ page: 1, pageSize: 100, taskId: row.id });
    progressDrawer.rows = result.data;
  } catch (error) {
    ElMessage.error((error as Error)?.message || "加载进度失败");
  } finally {
    progressDrawer.loading = false;
  }
}

const hasPendingProgress = computed(() => progressDrawer.rows.some((row) => row.status === "pending_review"));

onMounted(load);
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <span class="panel-bar" />
      <h3 class="panel-title">任务管理</h3>
      <div class="panel-head-extra">
        <el-button color="var(--color-primary)" @click="openCreate">新增任务</el-button>
      </div>
    </div>

    <div class="panel-body">
      <el-table :data="rows" border v-loading="loading">
        <el-table-column prop="name" label="任务名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="description" label="任务描述" min-width="220" show-overflow-tooltip />
        <el-table-column label="奖励积分" width="110">
          <template #default="{ row }">
            <span class="delta-add">+{{ row.rewardPoints }}</span>
          </template>
        </el-table-column>
        <el-table-column label="有效期" width="120">
          <template #default="{ row }">{{ row.deadline || "—" }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" effect="plain">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openProgress(row)">记录</el-button>
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button
              v-if="row.status !== 'published'"
              size="small"
              type="success"
              :loading="actingId === row.id"
              @click="toggleStatus(row)"
            >上架</el-button>
            <el-button v-else size="small" type="warning" :loading="actingId === row.id" @click="toggleStatus(row)">下架</el-button>
            <el-button size="small" type="danger" plain :disabled="actingId === row.id" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>

  <!-- 新增/编辑任务 -->
  <el-dialog v-model="dialog.visible" :title="dialog.editId ? '编辑任务' : '新增任务'" width="560px">
    <el-form label-width="90px">
      <el-form-item label="任务名称" required>
        <el-input v-model="form.name" maxlength="40" show-word-limit placeholder="例如：整理客户回访文档" />
      </el-form-item>
      <el-form-item label="任务描述">
        <el-input v-model="form.description" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="补充说明任务背景与执行方式（选填）" />
      </el-form-item>
      <el-form-item label="奖励积分" required>
        <el-input-number v-model="form.rewardPoints" :min="1" :max="99999" controls-position="right" style="width: 100%" />
      </el-form-item>
      <el-form-item label="有效期" required>
        <el-date-picker
          v-model="form.deadline"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="到期后员工不可再领取/提交"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="完成要求" required>
        <el-input v-model="form.requirement" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="说明验收标准，例如：上传回访记录截图" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>

  <!-- 任务进度抽屉（只读；审核动作在审核中心） -->
  <el-drawer v-model="progressDrawer.visible" size="50%" :title="`领取记录 · ${progressDrawer.task?.name || ''}`">
    <el-alert
      v-if="hasPendingProgress"
      title="该任务有成果待审核，请前往「审核中心 → 任务审核」处理"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 14px"
    />
    <el-table :data="progressDrawer.rows" border v-loading="progressDrawer.loading">
      <el-table-column label="员工" width="120">
        <template #default="{ row }">{{ row.employeeName || `员工(${row.employeeId})` }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="recordTag(row.status)" effect="plain">{{ recordText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="成果描述" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">{{ row.submissionText || "—" }}</template>
      </el-table-column>
      <el-table-column label="提交时间" width="140">
        <template #default="{ row }">{{ formatTimeText(row.submittedAt) || "—" }}</template>
      </el-table-column>
      <el-table-column label="审核意见" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.reviewRemark || "—" }}</template>
      </el-table-column>
    </el-table>
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

.delta-add {
  color: var(--color-points-add);
  font-weight: 600;
}
</style>
