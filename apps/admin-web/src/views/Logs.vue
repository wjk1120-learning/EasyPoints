<script setup lang="ts">
/**
 * 操作日志（PRD 5.6）：全部操作留痕查询，含「投票操作日志」类型（PRD 5.9.3）。
 * 支持五类日志筛选 + 时间范围筛选（PRD 5.6）。
 * 日志禁止删除、禁止修改，永久留存，本页只读。
 * 说明：后端日志接口暂无类型/时间筛选参数，本页拉取近期日志后客户端筛选+分页；
 *      投票后端未落地期间，投票操作日志由前端 vote mock 记录并合并展示。
 */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { logsPaged } from "../api/log/log";
import type { OperationLog } from "../api/log/types";
import type { VoteOpLog } from "../api/vote/types";
import { mockVoteLogs } from "../mock/vote";
import { isMockEnabled } from "../mock";
import { formatTimeText } from "../utils/format";
import { LOG_CATEGORY_OPTIONS, LOG_CATEGORY_TEXT, logCategory, logRemark, logTarget } from "../utils/log-category";

const rows = ref<OperationLog[]>([]);
const loading = ref(false);
/** 日志类型筛选：空=全部 */
const logType = ref("");
/** 时间范围筛选（PRD 5.6 按时间筛选） */
const dateRange = ref<[string, string] | "">("");
const pageSize = ref(50);
const page = ref(1);

/** 投票操作日志 → 操作日志行结构（mock 期间） */
function voteLogsAsRows(): OperationLog[] {
  if (!isMockEnabled()) return [];
  return mockVoteLogs().map((log: VoteOpLog) => ({
    id: 100000 + log.id,
    traceId: `trace-vote-${log.action}-${log.id}`,
    action: log.action,
    actionText: log.actionText,
    actorText: log.actorText,
    businessSummary: log.content,
    resultText: "成功",
    createdAt: log.createdAt,
    targetLabel: log.target,
    remark: log.remark
  })) as OperationLog[];
}

/** 合并真实日志与投票日志（mock 期间），推导操作对象/备注详情，按时间倒序 */
const mergedRows = computed(() =>
  [...rows.value, ...voteLogsAsRows()]
    .map((row) => ({
      ...row,
      targetLabel: row.targetLabel ?? logTarget(row.action, (row.payload || {}) as Record<string, unknown>),
      remark: row.remark ?? logRemark(row.action, (row.payload || {}) as Record<string, unknown>)
    }))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
);

/** 类型 + 时间范围筛选 */
const filteredRows = computed(() =>
  mergedRows.value.filter((row) => {
    if (logType.value && logCategory(row.action) !== logType.value) return false;
    if (dateRange.value) {
      const [start, end] = dateRange.value;
      const time = String(row.createdAt || "");
      if (start && time.slice(0, 10) < start) return false;
      if (end && time.slice(0, 10) > end) return false;
    }
    return true;
  })
);

/** 客户端分页 */
const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

watch([logType, dateRange, pageSize], () => {
  page.value = 1;
});

async function load() {
  loading.value = true;
  try {
    const result = await logsPaged({ page: 1, pageSize: 500 });
    rows.value = result.data;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <span class="panel-bar" />
      <h3 class="panel-title">操作日志</h3>
    </div>

    <div class="panel-body">
      <div class="filter-bar">
        <el-select v-model="logType" placeholder="日志类型" class="filter-item filter-item--md">
          <el-option value="" label="全部类型" />
          <el-option v-for="item in LOG_CATEGORY_OPTIONS" :key="item.value" :value="item.value" :label="item.label" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          class="filter-item--range"
          style="width: 280px; max-width: 280px; flex: 0 0 280px"
        />
        <el-select v-model="pageSize" placeholder="每页" class="filter-item filter-item--sm">
          <el-option :value="20" label="20 / 页" />
          <el-option :value="50" label="50 / 页" />
          <el-option :value="100" label="100 / 页" />
        </el-select>
      </div>

      <el-table :data="pagedRows" border v-loading="loading">
        <el-table-column label="类型" width="130">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ LOG_CATEGORY_TEXT[logCategory(row.action)] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="actorText" label="操作人" width="160" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="操作时间" width="190">
          <template #default="{ row }">{{ formatTimeText(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作对象" width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.targetLabel || "—" }}</template>
        </el-table-column>
        <el-table-column prop="businessSummary" label="操作内容" min-width="320" show-overflow-tooltip />
        <el-table-column label="备注详情" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || "—" }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="filteredRows.length"
          :page-size="pageSize"
          :current-page="page"
          @current-change="(p: number) => { page = p; }"
        />
      </div>
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

.filter-item--md {
  width: 180px;
}

// 日期范围选择器的宽度用内联样式固定（EP 的 date-picker 根元素不继承 scoped 标记，
// 且自带 flex-grow:1，类规则压不住，故写死在组件 style 上）
.filter-item--sm {
  width: 120px;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
