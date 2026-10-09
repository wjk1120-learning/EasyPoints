<script setup lang="ts">
/**
 * 总览工作台（PRD 5.1）：待审工单数、员工/礼品/任务数据看板 + 快捷入口直达审核页。
 * 任务类数据在阶段 3（任务管理）接入；积分申请走 mock，后端就绪后自动切换。
 */
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ArrowRight, Reading, Tickets, Medal, Check, Collection } from "@element-plus/icons-vue";
import { appeals as fetchAppeals } from "../api/appeal/appeal";
import { employees as fetchEmployees } from "../api/employee/employee";
import { mallGifts } from "../api/mall/mall";
import { orders as fetchOrders } from "../api/order/order";
import { applicationsPaged } from "../api/application/application";
import { taskRecordsPaged, tasksPaged } from "../api/task/task";
import { getRule } from "../api/rule/rule";
import type { Application } from "../api/application/types";

const router = useRouter();

const employeesCount = ref(0);
const giftsCount = ref(0);
const tasksCount = ref(0);
const pendingOrdersCount = ref(0);
const pendingAppealsCount = ref(0);
const pendingApplicationsCount = ref(0);
const pendingTasksCount = ref(0);
/** 积分规则（员工端规则中心实时同步内容） */
const ruleHtml = ref("");
const ruleLoading = ref(false);
const ruleEmpty = computed(() => !String(ruleHtml.value || "").replace(/<[^>]+>/g, "").trim());

const pendingTotal = computed(
  () => pendingOrdersCount.value + pendingAppealsCount.value + pendingApplicationsCount.value + pendingTasksCount.value
);

const quickEntries = computed(() => [
  { title: "礼品兑换审核", icon: Tickets, tone: "primary", count: pendingOrdersCount.value, route: "/review-center?tab=exchange", ready: true },
  { title: "任务积分审核", icon: Collection, tone: "info", count: pendingTasksCount.value, route: "/review-center?tab=task", ready: true },
  { title: "积分申请审核", icon: Medal, tone: "success", count: pendingApplicationsCount.value, route: "/review-center?tab=application", ready: true },
  { title: "申诉工单处理", icon: Check, tone: "warning", count: pendingAppealsCount.value, route: "/review-center?tab=appeal", ready: true }
]);

function isPendingStatus(status: string) {
  return String(status || "").startsWith("pending");
}

async function loadDashboard() {
  ruleLoading.value = true;
  try {
    const [employees, appeals, orders, gifts, applicationsResult, tasksResult, taskRecordsResult, rule] = await Promise.all([
      fetchEmployees(),
      fetchAppeals(),
      fetchOrders(),
      mallGifts(),
      applicationsPaged({ page: 1, pageSize: 200 }).catch(() => ({ data: [] as Application[], meta: { total: 0, page: 1, pageSize: 200 } })),
      tasksPaged({ page: 1, pageSize: 1 }).catch(() => ({ meta: { total: 0 } })),
      taskRecordsPaged({ page: 1, pageSize: 1, status: "pending_review" }).catch(() => ({ meta: { total: 0 } })),
      getRule().catch(() => null)
    ]);

    employeesCount.value = employees.length;
    giftsCount.value = gifts.length;
    pendingAppealsCount.value = appeals.filter((appeal) => isPendingStatus(appeal.status)).length;
    pendingOrdersCount.value = orders.filter((order) => order.status === "pending_review").length;
    pendingApplicationsCount.value = applicationsResult.data.filter((item) => item.status === "pending_review").length;
    tasksCount.value = tasksResult.meta.total;
    pendingTasksCount.value = taskRecordsResult.meta.total;
    ruleHtml.value = rule?.content || "";
  } catch (error) {
    console.error("加载工作台数据失败", error);
  } finally {
    ruleLoading.value = false;
  }
}

onMounted(() => {
  loadDashboard();
});
</script>

<template>
  <div class="dashboard">
    <!-- 待办处理：管理员进来的第一件事 -->
    <div class="section">
      <div class="section-head">
        <h3 class="section-title">待办处理</h3>
        <span class="section-extra" :class="{ 'is-warning': pendingTotal > 0 }">共 {{ pendingTotal }} 条待处理</span>
      </div>
      <div class="todo-grid">
        <div
          v-for="entry in quickEntries"
          :key="entry.title"
          class="todo-card"
          :class="{
            'todo-card--active': entry.ready && entry.count > 0,
            'todo-card--disabled': !entry.ready
          }"
          @click="entry.ready && router.push(entry.route)"
        >
          <div class="todo-chip" :class="`todo-chip--${entry.tone}`">
            <el-icon :size="20"><component :is="entry.icon" /></el-icon>
          </div>
          <div class="todo-body">
            <span class="todo-title">{{ entry.title }}</span>
            <span class="todo-count">
              <template v-if="entry.ready"><strong :class="{ 'is-active': entry.count > 0 }">{{ entry.count }}</strong> 条待审</template>
              <template v-else>阶段 3 上线</template>
            </span>
          </div>
          <el-icon v-if="entry.ready && entry.count > 0" class="todo-arrow"><ArrowRight /></el-icon>
        </div>
      </div>
    </div>

    <!-- 数据概览 -->
    <div class="stats-grid">
      <div class="stat-tile stat-tile--primary">
        <span class="stat-label">员工总人数</span>
        <strong class="stat-value">{{ employeesCount }}</strong>
      </div>
      <div class="stat-tile stat-tile--info">
        <span class="stat-label">任务总数</span>
        <strong class="stat-value">{{ tasksCount }}</strong>
      </div>
      <div class="stat-tile stat-tile--refund">
        <span class="stat-label">礼品总数</span>
        <strong class="stat-value">{{ giftsCount }}</strong>
      </div>
      <div class="stat-tile stat-tile--warning">
        <span class="stat-label">待审工单合计</span>
        <strong class="stat-value">{{ pendingTotal }}</strong>
      </div>
    </div>

    <!-- 积分规则（员工端实时同步） -->
    <div class="main">
      <el-card class="rules-card">
        <div class="rule-title">
          <el-icon color="var(--color-primary)" size="24" style="transform: translateY(2px)"><Reading /></el-icon>
          <h3>积分规则</h3>
          <span class="rule-sync-tag">员工端实时同步</span>
          <el-button size="small" text type="primary" @click="router.push('/rules')">前往编辑</el-button>
        </div>
        <div v-loading="ruleLoading" class="rule-body">
          <div v-if="ruleEmpty" class="rule-empty">
            暂无规则内容，请前往「规则配置」填写，保存后员工端实时生效。
          </div>
          <div v-else class="rule-preview" v-html="ruleHtml"></div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 小节标题（品牌竖条与全站 panel 语言一致）
.section {
  flex-shrink: 0;

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .section-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);

    &::before {
      content: "";
      width: 3px;
      height: 14px;
      border-radius: 2px;
      background: var(--color-primary);
    }
  }

  .section-extra {
    font-size: 13px;
    color: var(--color-text-secondary);

    &.is-warning {
      color: var(--color-status-pending);
      font-weight: 500;
    }
  }
}

// 待办处理卡：两行式紧凑布局，有待办的整卡点亮
.todo-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.todo-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s, background-color 0.2s;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.1);
    transform: translateY(-2px);

    .todo-arrow {
      transform: translateX(3px);
    }
  }

  // 有待办：整卡点亮（与全站"选中=浅蓝底"语言一致）
  &--active {
    border-color: var(--color-primary);
    background: var(--el-color-primary-light-9);
  }

  // 未上线：虚线灰卡，明确不可点
  &--disabled {
    cursor: not-allowed;
    border-style: dashed;
    opacity: 0.65;

    &:hover {
      border-color: var(--color-border);
      box-shadow: none;
      transform: none;
    }

    .todo-chip {
      background: var(--color-bg-muted);
      color: var(--color-text-placeholder);
    }
  }

  .todo-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  // 分域色彩：兑换蓝 / 申请绿 / 申诉琥珀 / 任务灰
  .todo-chip--primary {
    background: var(--el-color-primary-light-9);
    color: var(--color-primary);
  }

  .todo-chip--success {
    background: var(--el-color-success-light-9);
    color: var(--el-color-success);
  }

  .todo-chip--warning {
    background: var(--el-color-warning-light-9);
    color: var(--color-status-pending);
  }

  .todo-chip--info {
    background: var(--el-color-info-light-9);
    color: var(--el-color-info);
  }

  // 点亮态：图标块保持分域底色（蓝/绿/琥珀/灰），仅由卡片底色体现点亮

  .todo-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;

    .todo-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary);
    }

    .todo-count {
      font-size: 13px;
      color: var(--color-text-secondary);

      strong {
        font-size: 18px;
        font-weight: 700;
        margin-right: 2px;
        color: var(--color-text-primary);

        &.is-active {
          color: var(--color-primary);
        }
      }
    }
  }

  .todo-arrow {
    margin-left: auto;
    color: var(--color-primary);
    flex-shrink: 0;
    transition: transform 0.2s;
  }
}

// 数据概览：浅色瓷砖，纯展示、不可点，与白色可点待办卡形成材质区分
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 20px;
  flex-shrink: 0;
}

.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 20px;
  border-radius: 10px;

  .stat-label {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .stat-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
    color: var(--color-text-primary);
  }

  &--primary {
    background: var(--el-color-primary-light-9);

    .stat-value {
      color: var(--color-primary);
    }
  }

  &--refund {
    background: var(--el-color-success-light-9);

    .stat-value {
      color: var(--color-points-refund);
    }
  }

  &--info {
    background: var(--el-color-info-light-9);

    .stat-value {
      color: var(--color-text-primary);
    }
  }

  &--warning {
    background: var(--el-color-warning-light-9);

    .stat-value {
      color: var(--color-status-pending);
    }
  }
}

.main {
  flex: 1;
  min-height: 0;
  margin-top: 20px;
  display: flex;

  .rules-card {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    :deep(.el-card__body) {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .rule-title {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 5px 0 15px;
      border-bottom: 2px solid var(--color-border);

      h3 {
        margin: 0;
        font-weight: 500;
      }

      .rule-sync-tag {
        font-size: 12px;
        color: var(--color-primary);
        background: var(--el-color-primary-light-9);
        border-radius: 4px;
        padding: 2px 8px;
      }

      .el-button {
        margin-left: auto;
      }
    }

    // 内容超长时在卡内滚动，整页不出现滚动条
    .rule-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-top: 16px;

      .rule-empty {
        font-size: 13px;
        color: var(--color-text-secondary);
      }

      // 与规则配置预览一致的阅读排版
      .rule-preview {
        line-height: 1.8;
        color: var(--color-text-regular);

        :deep(h2) {
          font-size: 16px;
          color: var(--color-text-primary);
          border-left: 3px solid var(--color-primary);
          padding-left: 10px;
        }

        :deep(ul) {
          padding-left: 22px;
        }

        :deep(li) {
          margin-bottom: 6px;
        }
      }
    }
  }
}
</style>
