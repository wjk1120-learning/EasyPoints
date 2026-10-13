<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { CirclePlus, RemoveFilled } from "@element-plus/icons-vue";
import { employees as fetchEmployees } from "../api/employee/employee";
import type { Employee } from "../api/employee/types";
import { adjustment, monthlyBatch } from "../api/points/points";

const employees = ref<Employee[]>([]);
const single = reactive({
  employeeId: null as number | null,
  pointsDelta: 10,
  type: "reward" as "reward" | "penalty",
  remark: ""
});
/** 批量名单行：pointsDelta 为 null 表示未填写（提交前必须全部填写且非 0） */
const batch = reactive({
  month: new Date().toISOString().slice(0, 7),
  batchRemark: "",
  items: [] as { employeeId: number; pointsDelta: number | null; remark: string }[]
});
/** 范围选择：勾选的部门（仅负责往名单加人，移除在表格行内操作） */
const scopeDepartmentIds = ref<number[]>([]);
const addEmployeeId = ref<number | null>(null);
/** 部门勾选变化差集计算用的上一次快照 */
let prevDeptIds: number[] = [];

const monthOptions = computed(() => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: `${date.getFullYear()}年${date.getMonth() + 1}月` });
  }
  return options;
});

const employeeNameMap = computed(() => {
  const map = new Map<string, string>();
  for (const item of employees.value) map.set(String(item.id), item.name);
  return map;
});

/** 部门选项（从员工列表推导；员工数据已按管理员权限裁剪） */
const departmentOptions = computed(() => {
  const map = new Map<number, string>();
  for (const item of employees.value) {
    if (item.status !== "active") continue;
    if (!map.has(item.departmentId)) map.set(item.departmentId, item.departmentName || `部门${item.departmentId}`);
  }
  return [...map].map(([id, name]) => ({ id, name }));
});

/** 可搜索添加的员工（在职；已在名单的禁用） */
const addableEmployees = computed(() => employees.value.filter((item) => item.status === "active"));

function inBatch(employeeId: number) {
  return batch.items.some((row) => row.employeeId === employeeId);
}

/** 追加名单（按 employeeId 去重，仅在职员工），返回新增人数 */
function appendRows(list: Employee[]): number {
  let added = 0;
  for (const item of list) {
    if (item.status !== "active" || inBatch(item.id)) continue;
    batch.items.push({ employeeId: item.id, pointsDelta: null, remark: "" });
    added++;
  }
  return added;
}

function addDepartmentEmployees(departmentId: number) {
  const list = employees.value.filter((item) => item.departmentId === departmentId);
  const added = appendRows(list);
  const name = departmentOptions.value.find((item) => item.id === departmentId)?.name || `部门${departmentId}`;
  if (added) ElMessage.success(`已加入 ${name} ${added} 名员工`);
}

/** 部门勾选变化：勾选=整批加入；取消勾选=移出该部门中还未填写积分的人（已填分保留，避免误删工作量） */
function onDepartmentsChange(ids: number[]) {
  const removed = prevDeptIds.filter((id) => !ids.includes(id));
  const added = ids.filter((id) => !prevDeptIds.includes(id));
  for (const departmentId of added) addDepartmentEmployees(departmentId);
  if (removed.length) {
    let removedCount = 0;
    batch.items = batch.items.filter((row) => {
      const emp = employees.value.find((item) => item.id === row.employeeId);
      const inRemovedDept = Boolean(emp && removed.includes(emp.departmentId));
      const filled = row.pointsDelta != null && Number(row.pointsDelta) !== 0;
      if (inRemovedDept && !filled) {
        removedCount++;
        return false;
      }
      return true;
    });
    if (removedCount) ElMessage.info(`已移除 ${removedCount} 名未填写积分的员工（已填分的保留）`);
  }
  prevDeptIds = [...ids];
}

/** 一键加入权限内全部在职员工 */
function addAllEmployees() {
  const added = appendRows(employees.value);
  ElMessage.success(added ? `已加入全部在职员工 ${added} 名` : "全部员工均已在名单中");
}

/** 搜索添加单个员工（跨部门小团队场景），添加后清空选择 */
function onAddEmployee(employeeId: number) {
  const emp = employees.value.find((item) => item.id === employeeId);
  if (emp && appendRows([emp])) ElMessage.success(`已加入 ${emp.name}`);
  addEmployeeId.value = null;
}

function removeRow(index: number) {
  batch.items.splice(index, 1);
}

function formatEmployee(value: number | string | null | undefined) {
  if (value == null) return "";
  return employeeNameMap.value.get(String(value)) || String(value);
}

onMounted(async () => {
  try {
    employees.value = await fetchEmployees();
  } catch (error) {
    ElMessage.error((error as Error)?.message || "加载员工列表失败");
    return;
  }
  if (employees.value.length && single.employeeId == null) {
    const firstActive = employees.value.find((item) => item.status === "active");
    if (firstActive) single.employeeId = firstActive.id;
  }
});

async function submitSingle() {
  if (!single.employeeId) return ElMessage.warning("请选择员工");
  const remark = String(single.remark || "").trim();
  if (!remark) return ElMessage.warning("请填写变动原因备注（积分流水必须绑定备注）");
  const points = Number(single.pointsDelta);
  const normalizedPointsDelta = single.type === "penalty" ? -Math.abs(points) : Math.abs(points);
  try {
    await adjustment({ employeeId: single.employeeId, type: single.type, pointsDelta: normalizedPointsDelta, remark });
    ElMessage.success("单笔积分已提交，备注已写入流水");
    single.remark = "";
  } catch (error) {
    ElMessage.error((error as Error)?.message || "提交失败");
  }
}

async function submitBatch() {
  if (!batch.items.length) {
    ElMessage.warning("请先选择录入范围——可按部门勾选、一键全部员工，或搜索添加个别员工");
    return;
  }
  const blank = batch.items.filter((row) => row.pointsDelta == null || Number(row.pointsDelta) === 0);
  if (blank.length) {
    ElMessage.warning(`还有 ${blank.length} 人未填写积分（积分不能为空或 0，不给的人请移除）`);
    return;
  }
  const batchRemark = String(batch.batchRemark || "").trim();
  const missingRemark = batch.items.filter((row) => !String(row.remark || "").trim());
  if (!batchRemark && missingRemark.length) {
    ElMessage.warning(`请填写统一备注，或为 ${missingRemark.length} 名未填写单人备注的员工补充备注（积分流水必须绑定备注）`);
    return;
  }
  const monthLabel = monthOptions.value.find((item) => item.value === batch.month)?.label || batch.month;
  try {
    await ElMessageBox.confirm(
      h("div", { class: "batch-confirm-message" }, [
        h("p", { class: "batch-confirm-main" }, `即将为 ${batch.items.length} 名员工录入 ${monthLabel} 积分`),
        h("p", { class: "batch-confirm-remark" }, ["统一备注：", h("strong", null, batchRemark || "（未设置，将使用单人备注）")]),
        h("p", { class: "batch-confirm-tip" }, "提交后将生成不可修改的积分流水，请确认无误")
      ]),
      "高危操作确认",
      { type: "warning", confirmButtonText: "确认提交", cancelButtonText: "再检查一下" }
    );
  } catch {
    return;
  }
  try {
    await monthlyBatch({
      month: batch.month,
      batchRemark,
      items: batch.items.map((row) => ({ employeeId: row.employeeId, pointsDelta: Number(row.pointsDelta), remark: row.remark }))
    });
    ElMessage.success(`月度批量录分已提交（${batch.items.length} 名员工）`);
    batch.items = [];
    batch.batchRemark = "";
    scopeDepartmentIds.value = [];
    prevDeptIds = [];
  } catch (error) {
    ElMessage.error((error as Error)?.message || "提交失败");
  }
}
</script>

<template>
  <div class="points-page">
    <!-- 左侧面板：单笔奖惩加减分 -->
    <div class="panel panel-left">
      <div class="panel-head">
        <span class="panel-bar panel-bar--primary" />
        <h3 class="panel-title">单笔奖惩加减分</h3>
      </div>
      <div class="panel-body">
        <el-form :model="single" label-width="0" label-position="top" size="large">
          <el-form-item label="员工">
            <el-select v-model="single.employeeId" placeholder="搜索或选择员工" style="width: 100%">
              <el-option v-for="item in employees" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>

          <el-form-item label="变动类型">
            <el-segmented
              v-model="single.type"
              :options="[
                { value: 'reward', label: '加分' },
                { value: 'penalty', label: '扣分' }
              ]"
              class="type-segmented"
            >
              <template #default="{ item }">
                <span :class="['seg-option', item?.value]">
                  <el-icon :size="18">
                    <CirclePlus v-if="item?.value === 'reward'" />
                    <RemoveFilled v-else />
                  </el-icon>
                  <span>{{ item?.label }}</span>
                </span>
              </template>
            </el-segmented>
          </el-form-item>

          <el-form-item label="积分">
            <el-input-number v-model="single.pointsDelta" :min="1" controls-position="right" style="width: 100%" />
          </el-form-item>

          <el-form-item label="备注原因（必填）">
            <el-input
              v-model="single.remark"
              type="textarea"
              :rows="4"
              placeholder="例如：项目攻坚奖励、违规违纪处罚"
            />
          </el-form-item>

          <el-button type="primary" size="large" class="btn-primary" @click="submitSingle">
            提交单笔积分
          </el-button>
        </el-form>
      </div>
    </div>

    <!-- 右侧面板：月度批量录分 -->
    <div class="panel panel-right">
      <div class="panel-head">
        <span class="panel-bar panel-bar--alt" />
        <h3 class="panel-title">月度批量录分</h3>
      </div>
      <div class="panel-body panel-body--flex">
        <!-- 顶部筛选栏 -->
        <div class="batch-bar">
          <el-form :model="batch" label-width="0" label-position="top" size="default" class="batch-form">
            <el-form-item label="月份">
              <el-select v-model="batch.month" placeholder="选择月份" style="width: 100%">
                <el-option v-for="item in monthOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="统一备注">
              <el-input v-model="batch.batchRemark" type="textarea" :rows="1" placeholder="应用于所有未填写单人备注的记录" />
            </el-form-item>
          </el-form>
          <div class="batch-scope">
            <span class="scope-label">录入范围</span>
            <el-select
              v-model="scopeDepartmentIds"
              multiple
              collapse-tags
              collapse-tags-tooltip
              placeholder="勾选部门整批加入"
              style="width: 220px"
              @change="onDepartmentsChange"
            >
              <el-option v-for="item in departmentOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
            <el-button @click="addAllEmployees">全部员工</el-button>
            <el-select
              v-model="addEmployeeId"
              filterable
              placeholder="搜索姓名添加个别员工"
              style="width: 220px"
              @change="onAddEmployee"
            >
              <el-option
                v-for="item in addableEmployees"
                :key="item.id"
                :label="item.name"
                :value="item.id"
                :disabled="inBatch(item.id)"
              />
            </el-select>
          </div>
        </div>

        <!-- 可滚动表格区域 -->
        <div class="batch-table-wrap">
          <el-empty v-if="!batch.items.length" :image-size="90">
            <template #description>
              <p class="empty-title">请先选择录入范围</p>
              <p class="empty-hint">可按部门勾选、一键全部员工，或搜索添加个别员工</p>
            </template>
          </el-empty>
          <el-table v-else :data="batch.items" border size="small" style="width: 100%">
            <el-table-column label="员工" width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ formatEmployee(row.employeeId) }}</template>
            </el-table-column>
            <el-table-column label="积分" width="160">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.pointsDelta"
                  placeholder="必填"
                  controls-position="right"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="单人备注" min-width="200">
              <template #default="{ row }">
                <el-input v-model="row.remark" placeholder="留空则使用统一备注" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="removeRow($index)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 底部操作栏 -->
        <div class="batch-footer">
          <span class="batch-info">
            共 <strong>{{ batch.items.length }}</strong> 名员工
            <span class="batch-info-divider">|</span>
            统一备注：<em>{{ batch.batchRemark || '未设置' }}</em>
          </span>
          <el-button type="primary" size="large" class="btn-primary" @click="submitBatch">
            提交月度录分
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
// ==============================
// 页面容器：左右布局，高度撑满
// ==============================
.points-page {
  height: 100%;
  display: flex;
  gap: 20px;
}

// ==============================
// 面板基座
// ==============================
.panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-left {
  width: 380px;
  flex-shrink: 0;
}

.panel-right {
  flex: 1;
  min-width: 0;
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
}

.panel-bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}

.panel-bar--primary {
  background: var(--color-primary);
}

.panel-bar--alt {
  background: var(--color-text-secondary);
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

// ==============================
// 面板内容
// ==============================
.panel-body {
  padding: 24px 20px 20px;
}

.panel-body--flex {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

// ==============================
// 左侧表单
// ==============================
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

// ==============================
// 类型选择 Segmented 组件
// ==============================
.type-segmented {
  width: 100%;
  --el-segmented-item-selected-bg-color: var(--el-color-primary-light-8);

  :deep(.el-segmented__group) {
    border-radius: 8px;
    padding: 0;
  }

  :deep(.el-segmented__item) {
    height: 38px;
    padding: 0 16px;
    border-radius: 6px;
    border: 1px solid transparent;
    transition: all 0.2s ease;

    &:hover:not(.is-selected) {
      background: var(--color-bg-muted);
    }

    &.is-selected {
      border-color: var(--color-primary);
      color: var(--color-text-primary);
      font-weight: 600;
    }
  }
}

// 选项内容：图标 + 文字
.seg-option {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;

  .el-icon {
    transition: color 0.25s ease;
  }

  &.reward .el-icon {
    color: var(--color-points-add);
  }

  &.penalty .el-icon {
    color: var(--color-points-deduct);
  }
}

// 按钮
.btn-primary {
  width: 100%;
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
// 右侧批量录入
// ==============================

// 顶部过滤栏
.batch-bar {
  flex-shrink: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

// 录入范围选择行
.batch-scope {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;

  .scope-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-regular);
    flex-shrink: 0;
  }
}

// 空态引导
.empty-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-regular);
}

.empty-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--color-text-placeholder);
}

.batch-form {
  display: flex;
  gap: 16px;

  :deep(.el-form-item) {
    flex: 1;
    margin-bottom: 0;
    min-width: 180px;
  }
}

// 可滚动表格容器
.batch-table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 20px;

  // 美化滚动条
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

// 底部操作栏
.batch-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-page);
}

.batch-info {
  font-size: 13px;
  color: var(--color-text-placeholder);

  strong {
    color: var(--color-text-regular);
    font-weight: 600;
  }

  em {
    color: var(--color-text-regular);
    font-style: normal;
  }
}

.batch-info-divider {
  margin: 0 8px;
  color: var(--color-border);
}

// 右侧按钮不撑满
.panel-right .btn-primary {
  width: auto;
  min-width: 160px;
}
</style>

<style lang="scss">
// 批量录分高危确认弹窗（ElMessageBox 渲染在 body 下，需全局样式）：录入信息/统一备注/警示分行展示
.batch-confirm-message {
  .batch-confirm-main {
    margin: 0 0 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .batch-confirm-remark {
    margin: 0 0 4px;
    font-size: 13px;
    color: var(--color-text-secondary);

    strong {
      color: var(--color-primary);
    }
  }

  .batch-confirm-tip {
    margin: 0;
    font-size: 12px;
    color: var(--el-color-warning);
  }
}
</style>
