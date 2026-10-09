<script setup lang="ts">
/**
 * 审核管理中心（PRD 5.2）：兑换/任务/积分申请/申诉四类工单多 Tab 统一处理。
 * Tab 徽标为各类待办数（待办列表 meta 拼装）；面板审核动作广播 review:refresh 后自动重算。
 * 支持 ?tab=exchange|task|application|appeal 深链（旧路由 /orders 等重定向至此）。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ordersPaged } from "../api/order/order";
import { appealsPaged } from "../api/appeal/appeal";
import { applicationsPaged } from "../api/application/application";
import { taskRecordsPaged } from "../api/task/task";
import ExchangeReviewPanel from "../components/review/ExchangeReviewPanel.vue";
import TaskReviewPanel from "../components/review/TaskReviewPanel.vue";
import ApplicationReviewPanel from "../components/review/ApplicationReviewPanel.vue";
import AppealReviewPanel from "../components/review/AppealReviewPanel.vue";

const route = useRoute();

const TAB_KEYS = ["exchange", "task", "application", "appeal"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function normalizeTab(value: unknown): TabKey {
  const key = String(value || "");
  return (TAB_KEYS as readonly string[]).includes(key) ? (key as TabKey) : "exchange";
}

const activeTab = ref<TabKey>(normalizeTab(route.query.tab));

const counts = ref<Record<TabKey, number>>({ exchange: 0, task: 0, application: 0, appeal: 0 });

const totalPending = computed(
  () => counts.value.exchange + counts.value.task + counts.value.application + counts.value.appeal
);

/** 各类待办数：待办状态列表取 meta.total（pageSize=1 只拉总数） */
async function refreshCounts() {
  const [exchange, task, application, appeal] = await Promise.all([
    ordersPaged({ page: 1, pageSize: 1, status: "pending_review" }).catch(() => ({ meta: { total: 0 } })),
    taskRecordsPaged({ page: 1, pageSize: 1, status: "pending_review" }).catch(() => ({ meta: { total: 0 } })),
    applicationsPaged({ page: 1, pageSize: 1, status: "pending_review" }).catch(() => ({ meta: { total: 0 } })),
    appealsPaged({ page: 1, pageSize: 1, status: "pending_department_review" }).catch(() => ({ meta: { total: 0 } }))
  ]);
  counts.value = {
    exchange: exchange.meta.total,
    task: task.meta.total,
    application: application.meta.total,
    appeal: appeal.meta.total
  };
}

function handleReviewRefresh() {
  refreshCounts();
}

watch(
  () => route.query.tab,
  (value) => {
    activeTab.value = normalizeTab(value);
  }
);

onMounted(() => {
  refreshCounts();
  window.addEventListener("review:refresh", handleReviewRefresh);
});

onBeforeUnmount(() => {
  window.removeEventListener("review:refresh", handleReviewRefresh);
});
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <span class="panel-bar" />
      <h3 class="panel-title">审核管理中心</h3>
      <span class="panel-total" :class="{ 'is-warning': totalPending > 0 }">待办共 {{ totalPending }} 条</span>
    </div>

    <div class="panel-body">
      <el-tabs v-model="activeTab" class="review-tabs">
        <el-tab-pane name="exchange">
          <template #label>
            <el-badge :value="counts.exchange" :hidden="!counts.exchange" :max="99" class="tab-badge">礼品兑换审核</el-badge>
          </template>
          <ExchangeReviewPanel v-if="activeTab === 'exchange'" />
        </el-tab-pane>
        <el-tab-pane name="task">
          <template #label>
            <el-badge :value="counts.task" :hidden="!counts.task" :max="99" class="tab-badge">任务积分审核</el-badge>
          </template>
          <TaskReviewPanel v-if="activeTab === 'task'" />
        </el-tab-pane>
        <el-tab-pane name="application">
          <template #label>
            <el-badge :value="counts.application" :hidden="!counts.application" :max="99" class="tab-badge">积分申请审核</el-badge>
          </template>
          <ApplicationReviewPanel v-if="activeTab === 'application'" />
        </el-tab-pane>
        <el-tab-pane name="appeal">
          <template #label>
            <el-badge :value="counts.appeal" :hidden="!counts.appeal" :max="99" class="tab-badge">申诉工单处理</el-badge>
          </template>
          <AppealReviewPanel v-if="activeTab === 'appeal'" />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
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

.panel-total {
  margin-left: auto;
  font-size: 13px;
  color: var(--color-text-secondary);

  &.is-warning {
    color: var(--color-status-pending);
    font-weight: 500;
  }
}

.panel-body {
  padding: 6px 20px 20px;
}

.review-tabs {
  :deep(.el-tabs__item.is-active) {
    color: var(--color-primary);
  }

  :deep(.el-tabs__active-bar) {
    background-color: var(--color-primary);
  }

  .tab-badge {
    :deep(.el-badge__content) {
      position: absolute;
      top: 2px;
      right: -22px;
      transform: none;
    }
  }
}
</style>
