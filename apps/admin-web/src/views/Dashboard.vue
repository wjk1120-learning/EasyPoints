<script setup>
import { ref, onMounted } from "vue";
import { User, ShoppingBag, View, Document } from "@element-plus/icons-vue";
import { api } from "../api";

const employeesCount = ref(0);
const giftsCount = ref(0);
const pendingAppealsCount = ref(0);
const pendingOrdersCount = ref(0);

function getPendingAppealStatuses() {
  return ["pending_department_review"];
}

async function loadDashboard() {
  try {
    const [employees, appeals, orders, gifts] = await Promise.all([
      api.employees(),
      api.appeals(),
      api.orders(),
      api.mallGifts()
    ]);

    employeesCount.value = employees.length;
    giftsCount.value = gifts.filter((gift) => gift.status === "active").length;
    const pendingAppealStatuses = new Set(getPendingAppealStatuses());
    pendingAppealsCount.value = appeals.filter((appeal) => pendingAppealStatuses.has(appeal.status)).length;
    pendingOrdersCount.value = orders.filter((order) => order.status === "pending_review").length;
  } catch (error) {
    console.error("加载工作台数据失败", error);
  }
}

onMounted(() => {
  loadDashboard();
});
</script>

<template>
  <h1 class="page-title">工作台</h1>
  <div class="title-dec">
    <div class="title">PC 管理平台</div>
    <div class="remark">备注必填，流水留痕，导出可追溯</div>
  </div>
  <div class="metric-grid">
    <div class="metric">
      <div class="icon">
        <el-icon color="#003d9b" size="24"><User /></el-icon>
      </div>
      <span>在职员工</span>
      <strong>{{ employeesCount }}</strong>
    </div>
    <div class="metric">
      <div class="icon">
        <el-icon color="#003d9b" size="24"><ShoppingBag /></el-icon>
      </div>
      <span>可兑换礼品</span>
      <strong>{{ giftsCount }}</strong>
    </div>
    <div class="metric">
      <div class="icon">
        <el-icon color="#003d9b" size="24"><View /></el-icon>
      </div>
      <span>待审核申诉</span>
      <strong>{{ pendingAppealsCount }}</strong>
    </div>
    <div class="metric"><div class="icon">
        <el-icon color="#003d9b" size="24"><Document /></el-icon>
      </div>
      <span>待处理订单</span>
      <strong>{{ pendingOrdersCount }}</strong>
    </div>
  </div>
  <el-card class="panel" :style="{marginTop: '20px'}">
    <template #header>关键规则</template>
    <el-descriptions :column="1" border>
      <el-descriptions-item label="单笔奖惩">必须填写备注，否则后端拒绝提交</el-descriptions-item>
      <el-descriptions-item label="月度录分">统一备注可批量应用，单人备注优先覆盖</el-descriptions-item>
      <el-descriptions-item label="流水纠错">不修改原流水，通过冲正流水留痕</el-descriptions-item>
      <el-descriptions-item label="员工可见">每条积分变动都展示管理员、时间、类型和完整备注</el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>

<style>
.title-dec {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;

  .title {
    font-weight: 500;
    padding: 5px 10px;
    background-color: #82f9be;
    border-radius: 5px;
  }

}
</style>
