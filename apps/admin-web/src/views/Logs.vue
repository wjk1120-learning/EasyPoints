<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api } from "../api";

const rows = ref([]);
const loading = ref(false);
const meta = reactive({ total: 0, page: 1, pageSize: 50 });

const outboxRows = ref([]);
const outboxLoading = ref(false);
const outboxMeta = reactive({ total: 0, page: 1, pageSize: 50 });
const outboxQuery = reactive({ status: "", type: "", employeeId: "" });
const employees = ref([]);
const outboxTypes = ref([]);
const outboxConfig = ref({ processingTimeoutSec: 60, maxRetries: 3, batchSize: 50 });
const outboxPayloadDialog = reactive({ visible: false, title: "", payloadText: "" });

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, "0");
  const D = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

function employeeLabel(employeeId) {
  const id = Number(employeeId);
  if (!Number.isFinite(id)) return String(employeeId || "");
  const found = employees.value.find((item) => Number(item.id) === id);
  if (found) return `${found.name} (${found.id})`;
  return `员工 (${id})`;
}

function formatOutboxType(value) {
  const type = String(value || "");
  if (type === "point_changed") return "积分变动通知";
  if (type === "order_status") return "订单状态更新";
  if (type === "appeal_result") return "申诉处理结果";
  return type || "未知类型";
}

function formatOutboxStatusText(value) {
  const status = String(value || "");
  if (status === "pending") return "待处理";
  if (status === "processing") return "处理中";
  if (status === "mock_sent") return "已发送";
  if (status === "failed") return "发送失败";
  return status || "未知状态";
}

function formatOutboxResult(value) {
  const status = String(value || "");
  if (status === "failed") return { text: "失败", tagType: "danger" };
  if (status === "mock_sent") return { text: "成功", tagType: "success" };
  if (status === "processing") return { text: "处理中", tagType: "warning" };
  return { text: "待处理", tagType: "info" };
}

function outboxTraceId(row) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
  if (payload.traceId) return String(payload.traceId);
  const created = String(row.createdAt || row.updatedAt || "").slice(0, 10).replace(/-/g, "");
  const datePart = created || "00000000";
  const type = String(row.type || "outbox");
  if (type === "order_status" && payload.orderId != null) return `trace-${datePart}-order-${payload.orderId}`;
  return `trace-${datePart}-outbox-${row.id}`;
}

function outboxBusinessSummary(row) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
  const type = String(row?.type || "");
  if (type === "point_changed") {
    const delta = Number(payload.pointsDelta || 0);
    const deltaText = `${delta > 0 ? "+" : ""}${delta}`;
    const balanceText = payload.balance == null ? "" : `，当前余额 ${payload.balance}`;
    const remarkText = payload.remark ? `，备注：${payload.remark}` : "";
    return `${deltaText} 分${balanceText}${remarkText}`;
  }
  if (type === "order_status") {
    const parts = [];
    if (payload.giftName) parts.push(`礼品：${payload.giftName}`);
    else if (payload.orderId != null) parts.push(`订单：#${payload.orderId}`);
    if (payload.pointsCost != null && payload.pointsCost !== "") parts.push(`积分：${payload.pointsCost}`);
    if (payload.status) parts.push(`状态：${String(payload.status)}`);
    if (payload.reviewRemark) parts.push(`处理备注：${payload.reviewRemark}`);
    return parts.join("；") || "订单状态更新";
  }
  if (type === "appeal_result") {
    const parts = [];
    if (payload.reason) parts.push(`申诉原因：${payload.reason}`);
    if (payload.status) parts.push(`处理结果：${String(payload.status)}`);
    if (payload.resultRemark) parts.push(`处理备注：${payload.resultRemark}`);
    return parts.join("；") || "申诉处理结果";
  }
  if (payload.remark) return String(payload.remark);
  if (Object.keys(payload).length) return JSON.stringify(payload);
  return "";
}

function viewOutboxPayload(row) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : row?.payload;
  outboxPayloadDialog.title = `载荷 ID=${row.id} type=${row.type} status=${row.status}`;
  outboxPayloadDialog.payloadText = payload ? JSON.stringify(payload, null, 2) : "";
  outboxPayloadDialog.visible = true;
}

function formatOutboxStatus(value) {
  if (value === "pending") return "待处理";
  if (value === "processing") return "处理中";
  if (value === "mock_sent") return "测试发送";
  if (value === "failed") return "发送失败";
  return String(value || "");
}

async function load() {
  loading.value = true;
  try {
    const result = await api.logsPaged({
      page: meta.page,
      pageSize: meta.pageSize
    });
    rows.value = result.data;
    meta.total = result.meta.total;
  } finally {
    loading.value = false;
  }
}

async function loadOutbox() {
  outboxLoading.value = true;
  try {
    const result = await api.outboxPaged({
      page: outboxMeta.page,
      pageSize: outboxMeta.pageSize,
      status: outboxQuery.status,
      type: outboxQuery.type,
      employeeId: outboxQuery.employeeId
    });
    outboxRows.value = result.data;
    outboxMeta.total = result.meta.total;
  } finally {
    outboxLoading.value = false;
  }
}

async function loadOutboxMeta() {
  const result = await api.outboxMeta();
  outboxTypes.value = Array.isArray(result.types) ? result.types : [];
  outboxConfig.value = result.config || outboxConfig.value;
}

async function retryMessage(row) {
  try {
    await ElMessageBox.confirm(`重试该消息？\nID=${row.id}\ntype=${row.type}\nstatus=${row.status}`, "确认操作", {
      type: "warning",
      confirmButtonText: "重试",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  await api.retryOutbox(row.id);
  ElMessage.success("已重置为待派发");
  await loadOutbox();
}

async function dispatchNow() {
  try {
    await ElMessageBox.confirm("立即派发待处理消息？", "确认操作", {
      type: "warning",
      confirmButtonText: "派发",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }
  const result = await api.dispatchOutbox();
  ElMessage.success(`已派发：${result.sent}，失败：${result.failed}`);
  await loadOutbox();
}

async function retryFailedCurrentPage() {
  const targets = outboxRows.value.filter((row) => row.status === "failed");
  if (!targets.length) {
    ElMessage.warning("当前页没有发送失败的消息");
    return;
  }
  for (const row of targets) await api.retryOutbox(row.id);
  ElMessage.success(`已重置失败消息：${targets.length}`);
  await loadOutbox();
}

async function retryAllFailed() {
  try {
    await ElMessageBox.confirm("选择重试范围：", "重试失败消息", {
      type: "warning",
      confirmButtonText: "全部失败",
      cancelButtonText: "仅当前页",
      distinguishCancelAndClose: true
    });
    const result = await api.retryOutboxFailed({
      type: outboxQuery.type || undefined,
      employeeId: outboxQuery.employeeId || undefined
    });
    ElMessage.success(`已重置失败消息：${result.count}`);
    outboxMeta.page = 1;
    await loadOutbox();
  } catch (error) {
    if (String(error) === "cancel") return retryFailedCurrentPage();
  }
}

function viewPending() {
  outboxQuery.status = "pending";
}

function viewFailed() {
  outboxQuery.status = "failed";
}

watch(
  () => meta.pageSize,
  () => {
    meta.page = 1;
    load();
  }
);

watch(
  () => [outboxQuery.status, outboxQuery.type, outboxQuery.employeeId, outboxMeta.pageSize],
  () => {
    outboxMeta.page = 1;
    loadOutbox();
  }
);

onMounted(async () => {
  employees.value = await api.employees();
  await loadOutboxMeta();
  await load();
  await loadOutbox();
});
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <span class="panel-bar" />
      <h3 class="panel-title">操作日志</h3>
    </div>

    <div class="panel-body">
      <div class="filter-bar">
        <el-select v-model="meta.pageSize" placeholder="每页" class="filter-item filter-item--sm">
          <el-option :value="20" label="20 / 页" />
          <el-option :value="50" label="50 / 页" />
          <el-option :value="100" label="100 / 页" />
        </el-select>
      </div>

      <el-table :data="rows" border v-loading="loading">
        <el-table-column prop="traceId" label="trace_id" width="290" show-overflow-tooltip />
        <el-table-column prop="actionText" label="动作" width="140" />
        <el-table-column prop="actorText" label="操作人" width="180" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="时间" width="190">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="businessSummary" label="业务摘要" min-width="420" show-overflow-tooltip />
        <el-table-column prop="resultText" label="操作结果" width="100">
          <template #default="{ row }">
            <el-tag type="success">{{ row.resultText }}</el-tag>
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
            (p) => {
              meta.page = p;
              load();
            }
          "
        />
      </div>
    </div>
  </div>

  <div class="panel" style="margin-top: 20px">
    <div class="panel-head">
      <span class="panel-bar panel-bar--alt" />
      <h3 class="panel-title">消息 Outbox</h3>
    </div>

    <div class="panel-body">
      <div class="filter-bar">
        <el-select v-model="outboxQuery.status" clearable placeholder="状态" class="filter-item filter-item--md">
          <el-option value="pending" label="待处理" />
          <el-option value="processing" label="处理中" />
          <el-option value="mock_sent" label="测试发送" />
          <el-option value="failed" label="发送失败" />
        </el-select>
        <el-select v-model="outboxQuery.type" clearable placeholder="类型（type）" class="filter-item">
          <el-option v-for="item in outboxTypes" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select v-model="outboxQuery.employeeId" clearable placeholder="员工" class="filter-item">
          <el-option v-for="item in employees" :key="item.id" :label="item.name" :value="String(item.id)" />
        </el-select>
        <el-select v-model="outboxMeta.pageSize" placeholder="每页" class="filter-item filter-item--sm">
          <el-option :value="20" label="20 / 页" />
          <el-option :value="50" label="50 / 页" />
          <el-option :value="100" label="100 / 页" />
        </el-select>
      </div>

      <div class="filter-toolbar">
        <div class="filter-toolbar__left">
          <span class="filter-toolbar__label">配置：</span>
          <el-tag size="small">timeout={{ outboxConfig.processingTimeoutSec }}s</el-tag>
          <el-tag size="small">maxRetries={{ outboxConfig.maxRetries }}</el-tag>
          <el-tag size="small">batch={{ outboxConfig.batchSize }}</el-tag>
        </div>
        <div class="filter-toolbar__right">
          <el-button size="small" @click="viewPending">仅看待处理</el-button>
          <el-button size="small" type="danger" plain @click="viewFailed">仅看发送失败</el-button>
          <el-button size="small" type="danger" @click="retryAllFailed">重试全部失败</el-button>
          <el-button size="small" type="primary" @click="dispatchNow">立即派发</el-button>
        </div>
      </div>

      <el-table :data="outboxRows" border v-loading="outboxLoading">
        <el-table-column label="trace_id" width="290" show-overflow-tooltip>
          <template #default="{ row }">{{ outboxTraceId(row) }}</template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="160">
          <template #default="{ row }">{{ formatOutboxType(row.type) }}</template>
        </el-table-column>
        <el-table-column prop="employeeId" label="员工" width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ employeeLabel(row.employeeId) }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="时间" width="190">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column prop="businessSummary" label="业务摘要" min-width="420" show-overflow-tooltip>
          <template #default="{ row }">{{ outboxBusinessSummary(row) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="操作结果" width="120">
          <template #default="{ row }">
            <el-tag :type="formatOutboxResult(row.status).tagType">{{ formatOutboxResult(row.status).text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="retryCount" label="重试" width="90" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="viewOutboxPayload(row)">载荷</el-button>
            <el-button size="small" @click="retryMessage(row)">重试</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="outboxMeta.total"
          :page-size="outboxMeta.pageSize"
          :current-page="outboxMeta.page"
          @current-change="
            (p) => {
              outboxMeta.page = p;
              loadOutbox();
            }
          "
        />
      </div>
    </div>
  </div>

  <el-dialog v-model="outboxPayloadDialog.visible" :title="outboxPayloadDialog.title" width="700px">
    <el-input v-model="outboxPayloadDialog.payloadText" type="textarea" :rows="16" readonly />
  </el-dialog>
</template>

<style scoped lang="scss">
.panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8eaee;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: #fafbfc;
  border-bottom: 1px solid #e8eaee;
}

.panel-bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  background: #0056c1;
}

.panel-bar--alt {
  background: #4d6077;
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #181a23;
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
  width: 200px;
}

.filter-item--sm {
  width: 120px;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.filter-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.filter-toolbar__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-toolbar__label {
  font-size: 13px;
  color: #909399;
  white-space: nowrap;
}

.filter-toolbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-card__meta {
  font-size: 12px;
  color: #909399;
  letter-spacing: 0.3px;
}

.filter-card__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
