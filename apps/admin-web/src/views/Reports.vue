<script setup lang="ts">
/**
 * 数据导出管理（PRD 5.7）：五类数据导出，文件一律由后端生成 Excel，前端只触发下载。
 * 导出列口径（2026-10-10 定稿，契约见 docs/Easy-Points-API.md 3.5/9.6/11.5~11.8）：
 * - 全员积分数据表：每人一行（姓名 + 可用积分 + 累计积分），累计倒序
 * - 个人积分明细：流水明细含备注（PRD 核心规则），员工/月份必选
 * - 兑换记录表：姓名 + 兑换商品 + 兑换时间；任务审核记录表：领取人/状态/任务名称/任务成果
 * - 投票统计数据表：投票主题 + 选项票数 + 合计 + 最高票选项 + 参与人员明细（双 Sheet）
 */
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Document, Download, Files, DataAnalysis, Collection } from "@element-plus/icons-vue";
import { employees as fetchEmployees } from "../api/employee/employee";
import type { Employee } from "../api/employee/types";
import { exportPointRecordsXlsx, exportPointsSummaryXlsx } from "../api/report/report";
import { exportOrdersXlsx } from "../api/order/order";
import { exportTaskRecordsXlsx } from "../api/task/task";
import { exportVoteStatsXlsx, votesPaged } from "../api/vote/vote";
import type { Vote } from "../api/vote/vote";
import { ORDER_STATUS_MAP } from "../utils/status";
import { fileTimestamp } from "../utils/format";
import { saveBlob } from "../utils/request";

const employees = ref<Employee[]>([]);
const votes = ref<Vote[]>([]);

/** 各导出卡的筛选与 loading 状态 */
const full = reactive({ exporting: false });
const personal = reactive({ employeeId: "", month: "", exporting: false });
const exchange = reactive({ employeeId: "", status: "", exporting: false });
const taskExport = reactive({ status: "", exporting: false });
const voteExport = reactive({ voteId: "" as number | "", exporting: false });

const employeeOptions = computed(() => employees.value.map((item) => ({ id: item.id, name: item.name })));

/** 导出失败提示：接口未部署（404「接口不存在」等）时给可理解的文案，其余透传后端 msg */
function exportErrorMsg(error: unknown): string {
  const message = (error as Error)?.message || "导出失败";
  return /404|Cannot|not found|接口不存在/i.test(message) ? "导出接口暂不可用（当前后端未部署该接口，新后端接入后可用）" : message;
}

/** 1. 全员积分数据表（每人一行：姓名 + 可用积分 + 累计积分；后端待实现，契约 3.9） */
async function exportFull() {
  full.exporting = true;
  try {
    const blob = await exportPointsSummaryXlsx();
    saveBlob(blob, `全员积分数据表-${fileTimestamp()}.xlsx`);
    ElMessage.success("全员积分数据表已导出");
  } catch (error) {
    ElMessage.error(exportErrorMsg(error));
  } finally {
    full.exporting = false;
  }
}

/** 2. 个人积分明细（员工必选；月份可选——不选则导出该员工全部流水） */
async function exportPersonal() {
  if (!personal.employeeId) {
    ElMessage.warning("请先选择员工");
    return;
  }
  personal.exporting = true;
  try {
    const blob = await exportPointRecordsXlsx({ employeeId: personal.employeeId, month: personal.month || undefined });
    const who = employees.value.find((item) => String(item.id) === String(personal.employeeId))?.name || `员工(${personal.employeeId})`;
    saveBlob(blob, `积分明细-${who}-${personal.month || "全部"}-${fileTimestamp()}.xlsx`);
    ElMessage.success(personal.month ? "个人积分明细已导出" : "个人积分明细（全部月份）已导出");
  } catch (error) {
    ElMessage.error(exportErrorMsg(error));
  } finally {
    personal.exporting = false;
  }
}

/** 3. 兑换记录表（后端待实现，契约 3.9） */
async function exportExchange() {
  exchange.exporting = true;
  try {
    const blob = await exportOrdersXlsx({
      employeeId: exchange.employeeId || undefined,
      status: exchange.status || undefined
    });
    saveBlob(blob, `兑换记录表-${fileTimestamp()}.xlsx`);
    ElMessage.success("兑换记录表已导出");
  } catch (error) {
    ElMessage.error(exportErrorMsg(error));
  } finally {
    exchange.exporting = false;
  }
}

/** 4. 任务审核记录表（后端待实现，契约 3.9） */
async function exportTaskRecords() {
  taskExport.exporting = true;
  try {
    const blob = await exportTaskRecordsXlsx({ status: taskExport.status || undefined });
    saveBlob(blob, `任务审核记录表-${fileTimestamp()}.xlsx`);
    ElMessage.success("任务审核记录表已导出");
  } catch (error) {
    ElMessage.error(exportErrorMsg(error));
  } finally {
    taskExport.exporting = false;
  }
}

/** 5. 投票统计数据表（后端待实现，契约 3.7/3.9） */
async function exportVote() {
  if (!voteExport.voteId) {
    ElMessage.warning("请先选择投票");
    return;
  }
  voteExport.exporting = true;
  try {
    const vote = votes.value.find((item) => item.id === Number(voteExport.voteId));
    if (!vote) throw new Error("投票不存在");
    const blob = await exportVoteStatsXlsx(vote.id);
    saveBlob(blob, `投票统计-${vote.title}-${fileTimestamp()}.xlsx`);
    ElMessage.success("投票统计数据表已导出");
  } catch (error) {
    ElMessage.error(exportErrorMsg(error));
  } finally {
    voteExport.exporting = false;
  }
}

onMounted(async () => {
  employees.value = await fetchEmployees().catch(() => []);
  const votesResult = await votesPaged({ page: 1, pageSize: 200 }).catch(() => ({ data: [] as Vote[] }));
  votes.value = votesResult.data;
});
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <span class="panel-bar" />
      <h3 class="panel-title">数据导出</h3>
    </div>

    <div class="panel-body">
      <div class="export-grid">
        <!-- 1 全员积分数据表 -->
        <div class="export-card">
          <div class="export-head">
            <el-icon :size="20" color="var(--color-primary)"><Document /></el-icon>
            <div>
              <div class="export-name">全员积分数据表</div>
              <div class="export-desc">每人一行：姓名 + 可用积分 + 累计积分</div>
            </div>
          </div>
          <el-button type="primary" plain :icon="Download" :loading="full.exporting" @click="exportFull">导出 Excel</el-button>
        </div>

        <!-- 2 个人积分明细 -->
        <div class="export-card">
          <div class="export-head">
            <el-icon :size="20" color="var(--color-primary)"><Files /></el-icon>
            <div>
              <div class="export-name">个人积分明细</div>
              <div class="export-desc">按员工筛选积分流水明细（月份可选，不选导出全部），含备注</div>
            </div>
          </div>
          <div class="export-filters">
            <el-select v-model="personal.employeeId" clearable filterable placeholder="请选择员工（必选）" style="width: 170px">
              <el-option v-for="item in employeeOptions" :key="item.id" :label="item.name" :value="String(item.id)" />
            </el-select>
            <el-date-picker v-model="personal.month" type="month" value-format="YYYY-MM" placeholder="选择月份（可选）" style="width: 150px" />
          </div>
          <el-button type="primary" plain :icon="Download" :loading="personal.exporting" @click="exportPersonal">导出 Excel</el-button>
        </div>

        <!-- 3 兑换记录表 -->
        <div class="export-card">
          <div class="export-head">
            <el-icon :size="20" color="var(--color-points-refund)"><DataAnalysis /></el-icon>
            <div>
              <div class="export-name">兑换记录表</div>
              <div class="export-desc">导出姓名、兑换商品、兑换时间（可按员工/状态筛选）</div>
            </div>
          </div>
          <div class="export-filters">
            <el-select v-model="exchange.employeeId" clearable filterable placeholder="员工（可空）" style="width: 150px">
              <el-option v-for="item in employeeOptions" :key="item.id" :label="item.name" :value="String(item.id)" />
            </el-select>
            <el-select v-model="exchange.status" clearable placeholder="状态（可空）" style="width: 140px">
              <el-option v-for="(meta, key) in ORDER_STATUS_MAP" :key="key" :value="key" :label="meta.text" />
            </el-select>
          </div>
          <el-button type="primary" plain :icon="Download" :loading="exchange.exporting" @click="exportExchange">导出 Excel</el-button>
        </div>

        <!-- 4 任务审核记录表 -->
        <div class="export-card">
          <div class="export-head">
            <el-icon :size="20" color="var(--color-status-pending)"><Collection /></el-icon>
            <div>
              <div class="export-name">任务审核记录表</div>
              <div class="export-desc">导出任务领取人、状态、任务名称、任务成果</div>
            </div>
          </div>
          <div class="export-filters">
            <el-select v-model="taskExport.status" clearable placeholder="状态（可空）" style="width: 180px">
              <el-option value="in_progress" label="进行中" />
              <el-option value="pending_review" label="待审核" />
              <el-option value="approved" label="已通过" />
              <el-option value="rejected" label="已驳回" />
            </el-select>
          </div>
          <el-button type="primary" plain :icon="Download" :loading="taskExport.exporting" @click="exportTaskRecords">导出 Excel</el-button>
        </div>

        <!-- 5 投票统计数据表 -->
        <div class="export-card">
          <div class="export-head">
            <el-icon :size="20" color="var(--el-color-info)"><Collection /></el-icon>
            <div>
              <div class="export-name">投票统计数据表</div>
              <div class="export-desc">导出投票主题、各选项票数、最高票选项、参与明细（选投票）</div>
            </div>
          </div>
          <div class="export-filters">
            <el-select v-model="voteExport.voteId" filterable placeholder="选择投票" style="width: 300px">
              <el-option v-for="item in votes" :key="item.id" :value="item.id" :label="item.title" />
            </el-select>
          </div>
          <el-button type="primary" plain :icon="Download" :loading="voteExport.exporting" @click="exportVote">导出 Excel</el-button>
        </div>
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

.export-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.export-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;

  .export-head {
    display: flex;
    align-items: flex-start;
    gap: 12px;

    .el-icon {
      margin-top: 2px;
      flex-shrink: 0;
    }

    .export-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary);
    }

    .export-desc {
      margin-top: 4px;
      font-size: 12px;
      color: var(--color-text-secondary);
    }
  }

  .export-filters {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
}
</style>
