<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { CirclePlus, RemoveFilled } from "@element-plus/icons-vue";
import { api } from "../api";

const employees = ref([]);
const single = reactive({ employeeId: null, pointsDelta: 10, type: "reward", remark: "" });
const batch = reactive({
  month: new Date().toISOString().slice(0, 7),
  batchRemark: "",
  items: []
});

const monthOptions = computed(() => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: `${date.getFullYear()}年${date.getMonth() + 1}月` });
  }
  return options;
});

const employeeNameMap = computed(() => {
  const map = new Map();
  for (const item of employees.value) map.set(String(item.id), item.name);
  return map;
});

function formatEmployee(value) {
  if (value == null) return "";
  return employeeNameMap.value.get(String(value)) || String(value);
}

onMounted(async () => {
  employees.value = await api.employees();
  if (employees.value.length && single.employeeId == null) single.employeeId = employees.value[0].id;
  batch.items = employees.value.map((item) => ({ employeeId: item.id, pointsDelta: 0, remark: "" }));
});

async function submitSingle() {
  const points = Number(single.pointsDelta);
  const normalizedPointsDelta = single.type === "penalty" ? -Math.abs(points) : Math.abs(points);
  await api.adjustment({ ...single, pointsDelta: normalizedPointsDelta });
  ElMessage.success("单笔积分已提交，备注已写入流水");
  single.remark = "";
}

async function submitBatch() {
  await api.monthlyBatch(batch);
  ElMessage.success("月度批量录分已提交");
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
        </div>

        <!-- 可滚动表格区域 -->
        <div class="batch-table-wrap">
          <el-table :data="batch.items" border size="small" style="width: 100%">
            <el-table-column label="员工" width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ formatEmployee(row.employeeId) }}</template>
            </el-table-column>
            <el-table-column label="积分" width="160">
              <template #default="{ row }">
                <el-input-number v-model="row.pointsDelta" controls-position="right" size="small" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="单人备注" min-width="200">
              <template #default="{ row }">
                <el-input v-model="row.remark" placeholder="留空则使用统一备注" size="small" />
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
  border: 1px solid #e8eaee;
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
  background: #fafbfc;
  border-bottom: 1px solid #e8eaee;
}

.panel-bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}

.panel-bar--primary {
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
  color: #414654;
  padding-bottom: 4px;
  line-height: 1.4;
}

// ==============================
// 类型选择 Segmented 组件
// ==============================
.type-segmented {
  width: 100%;
  --el-segmented-item-selected-bg-color: #d8e2ff;

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
      background: #f4f7fc;
    }

    &.is-selected {
      border-color: #0056c1;
      color: #181a23;
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
    color: #059669;
  }

  &.penalty .el-icon {
    color: #dc2626;
  }
}

// 按钮
.btn-primary {
  width: 100%;
  border-radius: 6px;
  font-weight: 500;
  background-color: #0056c1;
  border-color: #0056c1;
  transition: all 0.2s;

  &:hover {
    background-color: #003d9b;
    border-color: #003d9b;
  }

  &:active {
    background-color: #002b7a;
    border-color: #002b7a;
  }
}

// ==============================
// 右侧批量录入
// ==============================

// 顶部过滤栏
.batch-bar {
  flex-shrink: 0;
  padding: 16px 20px;
  border-bottom: 1px solid #e8eaee;
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
    background: #d0d5dd;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #a8abb2;
  }
}

// 底部操作栏
.batch-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid #e8eaee;
  background: #fafbfc;
}

.batch-info {
  font-size: 13px;
  color: #a8abb2;

  strong {
    color: #414654;
    font-weight: 600;
  }

  em {
    color: #414654;
    font-style: normal;
  }
}

.batch-info-divider {
  margin: 0 8px;
  color: #e8eaee;
}

// 右侧按钮不撑满
.panel-right .btn-primary {
  width: auto;
  min-width: 160px;
}
</style>
