<script setup lang="ts">
/**
 * 积分申请审核面板（PRD 5.2）：嵌入审核中心 Tab。
 * 通过后双积分到账由后端负责；驳回原因必填，驳回后员工可申诉。
 */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { applicationsPaged, reviewApplication } from "../../api/application/application";
import type { Application } from "../../api/application/types";
import { employees as fetchEmployees } from "../../api/employee/employee";
import type { Employee } from "../../api/employee/types";
import RejectReasonDialog from "../RejectReasonDialog.vue";
import WorkOrderDetail from "../WorkOrderDetail.vue";
import type { WorkOrderField } from "../WorkOrderDetail.vue";
import { REVIEW_STATUS_MAP, statusMeta } from "../../utils/status";
import { formatTimeText } from "../../utils/format";
import { pendingFirst } from "../../utils/sort";
import { createSubmitLock } from "../../utils/submit-lock";

const rows = ref<Application[]>([]);
const loading = ref(false);
const meta = reactive({ total: 0, page: 1, pageSize: 50 });
const employees = ref<Employee[]>([]);
const query = reactive({ status: "", employeeId: "" });

const actingId = ref<number | null>(null);
const actLock = createSubmitLock();
const rejectDialog = reactive({ visible: false, applicationId: null as number | null, submitting: false });
const detailDialog = reactive({ visible: false, fields: [] as WorkOrderField[] });

const employeeNameMap = computed(() => {
  const map = new Map<string, string>();
  for (const item of employees.value) map.set(String(item.id), item.name);
  return map;
});

function employeeLabel(row: Application) {
  if (row.employeeName) return row.employeeName;
  return employeeNameMap.value.get(String(row.employeeId)) || String(row.employeeId);
}

const statusText = (value: string) => statusMeta(REVIEW_STATUS_MAP, value).text;
const statusTag = (value: string) => statusMeta(REVIEW_STATUS_MAP, value).tag;

async function load() {
  loading.value = true;
  try {
    const result = await applicationsPaged({
      page: meta.page,
      pageSize: meta.pageSize,
      status: query.status,
      employeeId: query.employeeId
    });
    rows.value = pendingFirst(result.data, (row) => row.status === "pending_review", (row) =>
      new Date(row.createdAt || 0).getTime()
    );
    meta.total = result.meta.total;
  } catch (error) {
    ElMessage.error((error as Error)?.message || "加载积分申请失败");
  } finally {
    loading.value = false;
  }
}

function notifyRefreshed() {
  window.dispatchEvent(new CustomEvent("review:refresh"));
  window.dispatchEvent(new CustomEvent("badges:refresh"));
}

function openDetail(row: Application) {
  detailDialog.fields = [
    { label: "申请人", value: employeeLabel(row) },
    { label: "申请分值", value: row.points, type: "delta" },
    { label: "申请缘由", value: row.reason },
    { label: "佐证材料", type: "images", images: row.evidenceImages || [] },
    { label: "申请时间", value: row.createdAt, type: "time" },
    { label: "当前状态", value: statusText(row.status) },
    { label: "审核意见", value: row.reviewRemark || "—" }
  ];
  detailDialog.visible = true;
}

async function approve(row: Application) {
  try {
    await ElMessageBox.confirm(
      `确认通过「${employeeLabel(row)}」的积分申请（+${row.points} 积分，双积分同步到账）？`,
      "审核通过",
      { type: "warning", confirmButtonText: "确认通过", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  await setStatus(row, "approved", "审核通过");
}

async function setStatus(row: Application, status: "approved" | "rejected", remark: string) {
  if (!actLock.acquire()) return;
  actingId.value = row.id;
  try {
    await reviewApplication(row.id, { status, remark });
    ElMessage.success(status === "approved" ? "已通过，积分将同步至员工双积分账户" : "已驳回，原因将推送员工");
    notifyRefreshed();
    if (meta.page > 1 && rows.value.length <= 1) meta.page = 1;
    await load();
  } catch (error) {
    ElMessage.error((error as Error)?.message || "操作失败");
  } finally {
    actingId.value = null;
    actLock.release();
  }
}

function openReject(row: Application) {
  rejectDialog.applicationId = row.id;
  rejectDialog.visible = true;
}

async function submitReject(reason: string) {
  const row = rows.value.find((item) => item.id === rejectDialog.applicationId);
  if (!row) return;
  rejectDialog.submitting = true;
  try {
    await setStatus(row, "rejected", reason);
    rejectDialog.visible = false;
  } finally {
    rejectDialog.submitting = false;
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
      <el-table-column label="申请人" width="140">
        <template #default="{ row }">{{ employeeLabel(row) }}</template>
      </el-table-column>
      <el-table-column label="申请分值" width="110">
        <template #default="{ row }">
          <span class="delta-add">+{{ row.points }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="申请缘由" min-width="240" show-overflow-tooltip />
      <el-table-column label="佐证" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.evidenceImages && row.evidenceImages.length" type="info" effect="plain" size="small">
            {{ row.evidenceImages.length }} 张
          </el-tag>
          <span v-else class="text-secondary">无</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)" effect="plain">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请时间" width="180">
        <template #default="{ row }">{{ formatTimeText(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'pending_review'">
            <el-button size="small" type="primary" :loading="actingId === row.id" @click="approve(row)">通过</el-button>
            <el-button size="small" type="danger" plain :disabled="actingId === row.id" @click="openReject(row)">驳回</el-button>
          </template>
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

  <RejectReasonDialog
    v-model="rejectDialog.visible"
    title="驳回积分申请"
    :loading="rejectDialog.submitting"
    placeholder="请填写驳回原因（必填），将推送并展示给员工"
    @confirm="submitReject"
  />

  <el-dialog v-model="detailDialog.visible" title="积分申请详情" width="580px">
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

.delta-add {
  color: var(--color-points-add);
  font-weight: 600;
}

.text-secondary {
  color: var(--color-text-secondary);
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
