<script setup lang="ts">
/**
 * 操作日志（PRD 5.6）：全部操作留痕查询，含「投票操作日志」类型（PRD 5.9.3）。
 * 支持五类日志筛选 + 时间范围筛选（PRD 5.6）。
 * 日志禁止删除、禁止修改，永久留存，本页只读。
 * 说明：类型/时间筛选走服务端参数（契约 11.4 type/startTime/endTime），分页由后端保证；
 *      投票操作日志由后端 vote.* 动作提供（附录 D），随操作日志统一查询展示。
 */
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { logsPaged } from "../api/log/log";
import type { OperationLog } from "../api/log/types";
import { formatTimeText } from "../utils/format";
import { LOG_CATEGORY_OPTIONS, LOG_CATEGORY_TEXT, logCategory, logRemark, logTarget } from "../utils/log-category";
import { apiErrorMsg } from "../utils/error";

const rows = ref<OperationLog[]>([]);
const loading = ref(false);
const total = ref(0);
/** 日志类型筛选（11.4 六类：points/review/appeal/gift_task/vote/system）：空=全部 */
const logType = ref("");
/** 时间范围筛选（PRD 5.6 按时间筛选） */
const dateRange = ref<[string, string] | "">("");
const pageSize = ref(50);
const page = ref(1);

/** 展示富化：targetLabel/remark 缺失时按 action+payload 推导（服务端已提供则直用） */
const displayRows = computed(() =>
  rows.value.map((row) => ({
    ...row,
    targetLabel: row.targetLabel ?? logTarget(row.action, (row.payload || {}) as Record<string, unknown>),
    remark: row.remark ?? logRemark(row.action, (row.payload || {}) as Record<string, unknown>)
  }))
);

watch([logType, dateRange, pageSize], () => {
  page.value = 1;
  load();
});

function dateBoundary(value: string, endOfDay = false): string {
  return endOfDay ? `${value} 23:59:59` : `${value} 00:00:00`;
}

async function load() {
  loading.value = true;
  try {
    const [start, end] = dateRange.value || ["", ""];
    const result = await logsPaged({
      page: page.value,
      pageSize: pageSize.value,
      type: logType.value || undefined,
      startTime: start ? dateBoundary(start) : undefined,
      endTime: end ? dateBoundary(end, true) : undefined
    });
    rows.value = result.data;
    total.value = result.meta.total;
  } catch (error) {
    ElMessage.error(apiErrorMsg(error, "加载操作日志失败"));
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

      <el-table :data="displayRows" border v-loading="loading">
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
          :total="total"
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
