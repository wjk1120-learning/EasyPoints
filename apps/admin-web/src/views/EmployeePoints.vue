<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Connection, Refresh, Search } from "@element-plus/icons-vue";
import { employees as fetchEmployees } from "../api/employee/employee";
import type { Employee } from "../api/employee/types";
import { adjustment } from "../api/points/points";
import { reportsPaged } from "../api/report/report";
import type { PointRecord } from "../api/report/types";
import { syncContacts } from "../api/wecom/wecom";
import { createSubmitLock } from "../utils/submit-lock";

const employees = ref<Employee[]>([]);
const loading = ref(false);
const syncing = ref(false);
const syncLock = createSubmitLock();
const keyword = ref("");
const selectedEmployeeId = ref<number | null>(null);
const selectedDepartmentId = ref<number | string>("");
const meta = reactive({ page: 1, pageSize: 10 });

const adjustDialog = reactive({
  visible: false,
  submitting: false,
  employeeId: null as number | null,
  employeeName: "",
  type: "reward" as "reward" | "penalty",
  pointsDelta: 10,
  remark: ""
});

const drawer = reactive({
  visible: false,
  loading: false,
  employeeId: null as number | null,
  employeeName: "",
  rows: [] as PointRecord[],
  meta: { total: 0, page: 1, pageSize: 20 }
});

const filtered = computed(() => {
  const key = String(keyword.value || "").trim().toLowerCase();
  let items = employees.value.slice();
  items.sort((a, b) => Number(b.pointsBalance || 0) - Number(a.pointsBalance || 0));
  if (selectedDepartmentId.value) {
    items = items.filter((item) => String(item.departmentId) === String(selectedDepartmentId.value));
  }
  if (!key) return items;
  return items.filter((item) => {
    const name = String(item.name || "").toLowerCase();
    const id = String(item.id || "");
    const dep = String(item.departmentName || item.departmentId || "").toLowerCase();
    return name.includes(key) || id.includes(key) || dep.includes(key);
  });
});

const total = computed(() => filtered.value.length);

const pagedData = computed(() => {
  const start = (meta.page - 1) * meta.pageSize;
  return filtered.value.slice(start, start + meta.pageSize);
});

watch(filtered, () => {
  const maxPage = Math.ceil(filtered.value.length / meta.pageSize) || 1;
  if (meta.page > maxPage) meta.page = maxPage;
});

watch([keyword, selectedDepartmentId], () => {
  meta.page = 1;
});

const departmentOptions = computed(() => {
  const seen = new Map<number, { departmentId: number; name: string }>();
  for (const emp of employees.value) {
    const id = emp.departmentId;
    if (id != null && !seen.has(id)) {
      seen.set(id, { departmentId: id, name: emp.departmentName || `部门(${id})` });
    }
  }
  return [...seen.values()].sort((a, b) => Number(a.departmentId || 0) - Number(b.departmentId || 0));
});

function formatStatus(value: unknown) {
  const status = String(value || "");
  if (status === "active") return "在职";
  if (status === "inactive") return "停用";
  return status || "";
}

function formatType(value: unknown) {
  const type = String(value || "");
  if (type === "reward") return "加分";
  if (type === "penalty") return "扣分";
  if (type === "performance") return "绩效";
  if (type === "exchange") return "兑换";
  if (type === "refund") return "退分";
  if (type === "reversal") return "冲正";
  return type || "";
}

function formatTime(value: string | number | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function resetFilters() {
  keyword.value = "";
  selectedDepartmentId.value = "";
  loadEmployees();
}

/** 企微通讯录一键同步：后端拉取部门/成员落库（新员工入库、离职禁用），完成后刷新列表 */
async function handleSync() {
  if (!syncLock.acquire()) return;
  syncing.value = true;
  try {
    const result = await syncContacts();
    const count = Array.isArray(result) ? result.length : 0;
    ElMessage.success(`同步完成，本次同步 ${count} 名员工`);
    await loadEmployees();
  } catch (error) {
    ElMessage.error((error as Error)?.message || "同步失败，请稍后重试");
  } finally {
    syncing.value = false;
    syncLock.release();
  }
}

async function loadEmployees() {
  loading.value = true;
  try {
    employees.value = await fetchEmployees();
    if (employees.value.length && selectedEmployeeId.value == null) selectedEmployeeId.value = employees.value[0].id;
  } finally {
    loading.value = false;
  }
}

function openAdjust(employee: Employee) {
  adjustDialog.employeeId = employee.id;
  adjustDialog.employeeName = employee.name;
  adjustDialog.type = "reward";
  adjustDialog.pointsDelta = 10;
  adjustDialog.remark = "";
  adjustDialog.visible = true;
}

async function submitAdjust() {
  const remark = String(adjustDialog.remark || "").trim();
  if (!remark) {
    ElMessage.warning("备注原因不能为空");
    return;
  }
  const points = Number(adjustDialog.pointsDelta);
  if (!Number.isFinite(points) || points <= 0) {
    ElMessage.warning("积分必须为正数");
    return;
  }
  adjustDialog.submitting = true;
  try {
    const normalizedPointsDelta =
      adjustDialog.type === "penalty" ? -Math.abs(points) : Math.abs(points);
    await adjustment({
      employeeId: adjustDialog.employeeId as number,
      type: adjustDialog.type,
      pointsDelta: normalizedPointsDelta,
      remark
    });
    ElMessage.success("积分已提交");
    adjustDialog.visible = false;
    await loadEmployees();
    if (drawer.visible && drawer.employeeId === adjustDialog.employeeId) await loadRecords({ reset: true });
  } catch (error) {
    ElMessage.error((error as Error)?.message || "提交失败");
  } finally {
    adjustDialog.submitting = false;
  }
}

function openDrawer(employee: Employee) {
  drawer.employeeId = employee.id;
  drawer.employeeName = employee.name;
  drawer.meta.page = 1;
  drawer.meta.pageSize = 20;
  drawer.visible = true;
  loadRecords({ reset: true });
}

async function loadRecords({ reset }: { reset?: boolean } = {}) {
  if (!drawer.employeeId) return;
  drawer.loading = true;
  try {
    if (reset) {
      drawer.rows = [];
      drawer.meta.page = 1;
    }
    const result = await reportsPaged({
      page: drawer.meta.page,
      pageSize: drawer.meta.pageSize,
      employeeId: drawer.employeeId
    });
    drawer.rows = result.data;
    drawer.meta.total = result.meta.total;
  } finally {
    drawer.loading = false;
  }
}

onMounted(async () => {
  await loadEmployees();
});
</script>

<template>
  <div class="employee-points-page">
    <div class="panel">
      <!-- 面板头部 -->
      <div class="panel-head">
        <span class="panel-bar" />
        <h3 class="panel-title">员工积分管理</h3>
      </div>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <el-input
          v-model="keyword"
          :prefix-icon="Search"
          placeholder="搜索员工姓名/ID"
          clearable
          class="filter-item filter-search"
        />
        <el-select v-model="selectedDepartmentId" clearable placeholder="全部部门" class="filter-item">
          <el-option v-for="item in departmentOptions" :key="item.departmentId" :label="item.name" :value="item.departmentId" />
        </el-select>
        <el-button :icon="Refresh" :loading="loading" @click="resetFilters">重置</el-button>
        <el-button type="primary" plain :icon="Connection" :loading="syncing" @click="handleSync">同步企微通讯录</el-button>
      </div>

      <!-- 表格 -->
      <div class="table-wrap">
        <el-table
          :data="pagedData"
          v-loading="loading"
          row-key="id"
          highlight-current-row
          class="emp-table"
          @current-change="(row: { id?: number } | null) => (selectedEmployeeId = row?.id ?? null)"
        >
          <el-table-column prop="id" label="员工ID" min-width="100" />
          <el-table-column label="姓名" min-width="120" prop="name" />
          <el-table-column label="部门" min-width="100">
            <template #default="{ row }">{{ row.departmentName || `部门(${row.departmentId})` }}</template>
          </el-table-column>
          <el-table-column prop="pointsBalance" label="当前积分" min-width="120">
            <template #default="{ row }">
              <span :class="['balance-text', row.pointsBalance > 0 ? 'balance-positive' : 'balance-zero']">
                {{ row.pointsBalance }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" min-width="100">
            <template #default="{ row }">
              <span :class="['status-badge', row.status === 'active' ? 'status-active' : 'status-inactive']">
                <span class="status-dot" />
                <span>{{ formatStatus(row.status) }}</span>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="350">
            <template #default="{ row }">
              <el-button plain size="small" class="btn-action" @click="openAdjust(row)">加减积分</el-button>
              <el-button plain size="small" class="btn-action btn-action-secondary" @click="openDrawer(row)">查看流水</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 底部分页 -->
      <div class="pagination-bar">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="total"
          :page-size="meta.pageSize"
          :current-page="meta.page"
          @current-change="(p: number) => { meta.page = p; }"
        />
      </div>
    </div>
  </div>

  <!-- 积分加减对话框 -->
  <el-dialog v-model="adjustDialog.visible" title="积分加减" width="520px" class="adjust-dialog">
    <el-form label-width="100px">
      <el-form-item label="员工">
        <el-input :model-value="`${adjustDialog.employeeName} (${adjustDialog.employeeId})`" disabled />
      </el-form-item>
      <el-form-item label="变动类型">
        <el-segmented v-model="adjustDialog.type" :options="[{ value: 'reward', label: '加分' }, { value: 'penalty', label: '扣分' }]" class="dialog-segmented" />
      </el-form-item>
      <el-form-item label="积分">
        <el-input-number v-model="adjustDialog.pointsDelta" :min="1" controls-position="right" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备注原因" required>
        <el-input v-model="adjustDialog.remark" type="textarea" :rows="3" placeholder="例如：项目攻坚奖励、违规违纪处罚" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="adjustDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="adjustDialog.submitting" class="btn-primary" @click="submitAdjust">提交</el-button>
    </template>
  </el-dialog>

  <!-- 积分流水抽屉 -->
  <el-drawer v-model="drawer.visible" size="60%" class="records-drawer">
    <template #header>
      <div class="drawer-head">
        <span class="drawer-bar" />
        <span class="drawer-title">积分流水 · {{ drawer.employeeName }} ({{ drawer.employeeId }})</span>
      </div>
    </template>
    <div class="drawer-body">
      <el-table :data="drawer.rows" border v-loading="drawer.loading" class="drawer-table">
        <el-table-column prop="pointsDelta" label="分值" width="120" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.type === 'reward' ? 'success' : row.type === 'penalty' ? 'danger' : 'info'" size="small" effect="plain">
              {{ formatType(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="260" show-overflow-tooltip />
        <el-table-column prop="operatorName" label="操作人" width="140" />
        <el-table-column prop="occurredAt" label="时间" width="190">
          <template #default="{ row }">{{ formatTime(row.occurredAt) }}</template>
        </el-table-column>
      </el-table>
      <div class="drawer-pagination">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="drawer.meta.total"
          :page-size="drawer.meta.pageSize"
          :current-page="drawer.meta.page"
          @current-change="(p: number) => { drawer.meta.page = p; loadRecords(); }"
        />
      </div>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
// ==============================
// 页面容器
// ==============================
.employee-points-page {
  height: 100%;
}

// ==============================
// 面板
// ==============================
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  overflow: hidden;
}

// ==============================
// 面板头部
// ==============================
.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
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

// ==============================
// 筛选栏
// ==============================
.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.filter-item {
  width: 200px;
}

.filter-search {
  width: 260px;
}

// ==============================
// 表格容器
// ==============================
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 20px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-placeholder);
  }
}

// ==============================
// 表格样式
// ==============================
.emp-table {
  width: 100%;

  :deep(.el-table__header th) {
    background: var(--color-bg-muted);
    color: var(--color-text-regular);
    font-weight: 600;
    font-size: 13px;
  }

  :deep(.el-table__row) {
    transition: background 0.15s;

    &:hover > td {
      background: var(--el-color-primary-light-9);
    }
  }
}

// 积分数值
.balance-text {
  font-weight: 600;
  font-size: 14px;
}

.balance-positive {
  color: var(--color-primary);
}

.balance-zero {
  color: var(--color-points-deduct);
}

// 状态徽标
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 30px;
  font-size: 13px;
}

.status-active {
  background-color: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.status-inactive {
  background-color: var(--el-color-info-light-9);
  color: var(--color-status-neutral);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  .status-active & {
    background-color: var(--el-color-success);
  }

  .status-inactive & {
    background-color: var(--color-text-placeholder);
  }
}

// 操作按钮
.btn-action {
  border-radius: 6px;
  font-weight: 500;
  color: var(--color-primary);
  border-color: var(--color-primary);

  &:hover {
    color: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
    background: var(--el-color-primary-light-9);
  }
}

.btn-action-secondary {
  color: var(--color-text-regular);
  border-color: var(--color-border);

  &:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-placeholder);
    background: var(--color-bg-muted);
  }
}

// ==============================
// 底部分页
// ==============================
.pagination-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-page);
}

// ==============================
// 对话框样式
// ==============================
.adjust-dialog {
  :deep(.el-dialog__header) {
    padding: 16px 24px;
    margin: 0;
    border-bottom: 1px solid var(--color-border);
    font-weight: 600;
    font-size: 16px;
  }

  :deep(.el-dialog__body) {
    padding: 24px;
  }

  :deep(.el-dialog__footer) {
    padding: 12px 24px;
    border-top: 1px solid var(--color-border);
    margin: 0;
  }

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-regular);
    padding-bottom: 4px;
    line-height: 1.4;
  }
}

.dialog-segmented {
  :deep(.el-segmented__item) {
    height: 34px;
    padding: 0 20px;
    border-radius: 6px;
    transition: all 0.2s;
  }
}

.btn-primary {
  border-radius: 6px;
  font-weight: 500;
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  transition: all 0.2s;

  &:hover {
    background-color: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }

  &:active {
    background-color: var(--color-primary-active);
    border-color: var(--color-primary-active);
  }
}

// ==============================
// 抽屉样式
// ==============================
.records-drawer {
  :deep(.el-drawer__header) {
    padding: 16px 24px;
    margin: 0;
    border-bottom: 1px solid var(--color-border);
  }

  :deep(.el-drawer__body) {
    padding: 0;
  }
}

.drawer-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  background: var(--color-primary);
}

.drawer-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.drawer-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow-y: auto;
}

.drawer-table {
  width: 100%;

  :deep(.el-table__header th) {
    background: var(--color-bg-muted);
    color: var(--color-text-regular);
    font-weight: 600;
    font-size: 13px;
  }

  :deep(.el-table__row:hover > td) {
    background: var(--el-color-primary-light-9);
  }
}

.drawer-pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
