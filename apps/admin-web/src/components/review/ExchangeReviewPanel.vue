<script setup lang="ts">
/**
 * 兑换审核面板（PRD 5.2）：嵌入审核中心 Tab。
 * 审核动作完成后广播 review:refresh（审核中心计数）与 badges:refresh（顶栏角标）。
 */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ordersPaged, updateOrder } from "../../api/order/order";
import type { Order } from "../../api/order/types";
import { employees as fetchEmployees } from "../../api/employee/employee";
import type { Employee } from "../../api/employee/types";
import RejectReasonDialog from "../RejectReasonDialog.vue";
import WorkOrderDetail from "../WorkOrderDetail.vue";
import type { WorkOrderField } from "../WorkOrderDetail.vue";
import { ORDER_STATUS_MAP, statusMeta } from "../../utils/status";
import { formatTimeText } from "../../utils/format";
import { pendingFirst } from "../../utils/sort";
import { createSubmitLock } from "../../utils/submit-lock";

const rows = ref<Order[]>([]);
const loading = ref(false);
const meta = reactive({ total: 0, page: 1, pageSize: 50 });
const employees = ref<Employee[]>([]);
const query = reactive({ status: "", employeeId: "" });

const actingId = ref<number | null>(null);
const actLock = createSubmitLock();
const rejectDialog = reactive({ visible: false, orderId: null as number | null, submitting: false });
const detailDialog = reactive({ visible: false, fields: [] as WorkOrderField[] });

const employeeNameMap = computed(() => {
  const map = new Map<string, string>();
  for (const item of employees.value) map.set(String(item.id), item.name);
  return map;
});

function employeeLabel(value: number | string | null | undefined, fallbackName?: string) {
  if (fallbackName) return fallbackName;
  if (value == null) return "";
  return employeeNameMap.value.get(String(value)) || String(value);
}

const statusText = (value: string) => statusMeta(ORDER_STATUS_MAP, value).text;
const statusTag = (value: string) => statusMeta(ORDER_STATUS_MAP, value).tag;

async function load() {
  loading.value = true;
  try {
    const result = await ordersPaged({
      page: meta.page,
      pageSize: meta.pageSize,
      status: query.status,
      employeeId: query.employeeId
    });
    rows.value = pendingFirst(result.data, (row) => row.status === "pending_review", (row) =>
      new Date(row.updatedAt || row.createdAt || 0).getTime()
    );
    meta.total = result.meta.total;
  } finally {
    loading.value = false;
  }
}

function notifyRefreshed() {
  window.dispatchEvent(new CustomEvent("review:refresh"));
  window.dispatchEvent(new CustomEvent("badges:refresh"));
}

function openDetail(row: Order) {
  detailDialog.fields = [
    { label: "申请人", value: employeeLabel(row.employeeId, row.employeeName) },
    { label: "礼品", value: row.giftName },
    { label: "消耗积分", value: row.pointsCost, type: "delta" },
    { label: "申请时间", value: row.createdAt, type: "time" },
    { label: "当前状态", value: statusText(row.status) },
    { label: "处理备注", value: row.remark || "—" }
  ];
  detailDialog.visible = true;
}

async function setStatus(row: Order, status: string, remark: string) {
  if (!actLock.acquire()) return;
  actingId.value = row.id;
  try {
    await updateOrder(row.id, { status, remark });
    ElMessage.success(status === "rejected" ? "已驳回，积分已退回员工账户" : "订单状态已更新");
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

async function approve(row: Order) {
  try {
    await ElMessageBox.confirm(
      `确认通过「${employeeLabel(row.employeeId, row.employeeName)}」兑换「${row.giftName}」（${row.pointsCost} 积分）？`,
      "审核通过",
      { type: "warning", confirmButtonText: "确认通过", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  await setStatus(row, "approved", "审核通过");
}

function openReject(row: Order) {
  rejectDialog.orderId = row.id;
  rejectDialog.visible = true;
}

async function submitReject(reason: string) {
  const row = rows.value.find((item) => item.id === rejectDialog.orderId);
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
        <template #default="{ row }">{{ employeeLabel(row.employeeId, row.employeeName) }}</template>
      </el-table-column>
      <el-table-column prop="giftName" label="礼品" min-width="180" />
      <el-table-column label="消耗积分" width="110">
        <template #default="{ row }">
          <span class="delta-cost">-{{ row.pointsCost }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)" effect="plain">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ formatTimeText(row.updatedAt || row.createdAt) }}</template>
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
    title="驳回兑换申请"
    :loading="rejectDialog.submitting"
    placeholder="请填写驳回原因（必填），将推送并展示给员工"
    @confirm="submitReject"
  />

  <el-dialog v-model="detailDialog.visible" title="兑换工单详情" width="560px">
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

.delta-cost {
  color: var(--color-points-deduct);
  font-weight: 600;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
