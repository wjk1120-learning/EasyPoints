<script setup>
import { ref, onMounted } from "vue";
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
  <div class="metric-grid">
    <div class="metric">
      <span>在职员工</span>
      <strong>{{ employeesCount }}</strong>
    </div>
    <div class="metric">
      <span>可兑换礼品</span>
      <strong>{{ giftsCount }}</strong>
    </div>
    <div class="metric">
      <span>待审核申诉</span>
      <strong>{{ pendingAppealsCount }}</strong>
    </div>
    <div class="metric">
      <span>待处理订单</span>
      <strong>{{ pendingOrdersCount }}</strong>
    </div>
  </div>
  <el-card class="panel">
    <template #header>关键规则</template>
    <el-descriptions :column="1" border>
      <el-descriptions-item label="单笔奖惩">必须填写备注，否则后端拒绝提交</el-descriptions-item>
      <el-descriptions-item label="月度录分">统一备注可批量应用，单人备注优先覆盖</el-descriptions-item>
      <el-descriptions-item label="流水纠错">不修改原流水，通过冲正流水留痕</el-descriptions-item>
      <el-descriptions-item label="员工可见">每条积分变动都展示管理员、时间、类型和完整备注</el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>
