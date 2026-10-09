<script setup lang="ts">
/**
 * 操作日志（PRD 5.6）：全部操作留痕查询，含「投票操作日志」类型（PRD 5.9.3）。
 * 日志禁止删除、禁止修改，永久留存，本页只读。
 * 投票后端未落地期间，投票操作日志由前端 vote mock 记录并合并展示（isMockEnabled 时）。
 */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { logsPaged } from "../api/log/log";
import type { OperationLog } from "../api/log/types";
import type { VoteOpLog } from "../api/vote/types";
import { mockVoteLogs } from "../mock/vote";
import { isMockEnabled } from "../mock";

const rows = ref<OperationLog[]>([]);
const loading = ref(false);
const meta = reactive({ total: 0, page: 1, pageSize: 50 });
/** 日志类型筛选：全部 / vote（投票操作日志）/ system（系统操作） */
const logType = ref("");

/** 投票操作日志 → 操作日志行结构（mock 期间） */
function voteLogsAsRows(): OperationLog[] {
  if (!isMockEnabled()) return [];
  return mockVoteLogs().map((log: VoteOpLog, index) => ({
    id: 100000 + log.id,
    traceId: `trace-vote-${log.action}-${log.id}`,
    action: log.action,
    actionText: log.actionText,
    actorText: log.actorText,
    businessSummary: `投票「${log.voteTitle}」：${log.detail}`,
    resultText: "成功",
    createdAt: log.createdAt,
    _order: index
  })) as OperationLog[];
}

const displayRows = computed(() => {
  const voteRows = voteLogsAsRows();
  if (logType.value === "vote") return voteRows;
  const merged = [...rows.value, ...voteRows].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  if (logType.value === "system") return merged.filter((row) => !String(row.action || "").startsWith("vote."));
  return merged;
});

const displayTotal = computed(() => (logType.value ? displayRows.value.length : meta.total));

function formatTime(value: string | number | undefined) {
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

async function load() {
  loading.value = true;
  try {
    const result = await logsPaged({
      page: meta.page,
      pageSize: meta.pageSize
    });
    rows.value = result.data;
    meta.total = result.meta.total;
  } finally {
    loading.value = false;
  }
}

watch(
  () => meta.pageSize,
  () => {
    meta.page = 1;
    load();
  }
);

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
          <el-option value="vote" label="投票操作日志" />
          <el-option value="system" label="系统操作" />
        </el-select>
        <el-select v-model="meta.pageSize" placeholder="每页" class="filter-item filter-item--sm">
          <el-option :value="20" label="20 / 页" />
          <el-option :value="50" label="50 / 页" />
          <el-option :value="100" label="100 / 页" />
        </el-select>
      </div>

      <el-table :data="displayRows" border v-loading="loading">
        <el-table-column prop="traceId" label="追踪编号" width="290" show-overflow-tooltip />
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
          :total="displayTotal"
          :page-size="meta.pageSize"
          :current-page="meta.page"
          @current-change="
            (p: number) => {
              meta.page = p;
              load();
            }
          "
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

.filter-item--sm {
  width: 120px;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
