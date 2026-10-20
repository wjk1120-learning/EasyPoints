<script setup lang="ts">
/**
 * 消息派发（outbox 运维面板，推送可靠性方案 P2-1）：
 * 全部通知消息的投递状态查询与人工兜底——失败原因归因（failReason）、单条重试、批量重试 failed。
 * 数据源与员工端通知中心同表（message_outbox）；列表/重试均受后端辖内部门裁剪（契约 10.4~10.7）。
 * 重试语义（P0-2）：置回待发送且重试计数归零、清空失败原因，worker（每 5 秒一轮）自动重新投递。
 */
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { outboxMeta, outboxPaged, retryOutboxFailed, retryOutboxOne } from "../api/outbox/outbox";
import type { OutboxMessage } from "../api/outbox/types";
import { employees } from "../api/employee/employee";
import type { Employee } from "../api/employee/types";
import { formatTimeText } from "../utils/format";
import { apiErrorMsg } from "../utils/error";

/** 消息类型中文（与后端 schema chk_outbox_type 枚举一致） */
const TYPE_TEXT: Record<string, string> = {
  point_changed: "积分变动",
  order_status: "订单状态",
  appeal_result: "申诉结果",
  task_review: "任务审核",
  application_review: "积分申请",
  vote_invitation: "投票邀请",
  rule_update: "规则更新"
};

/** 状态中文与语义色（sent 绿 / failed 红 / pending 灰 / processing 橙） */
const STATUS_TEXT: Record<string, string> = {
  pending: "待发送",
  processing: "发送中",
  sent: "已发送",
  failed: "发送失败"
};
const STATUS_TAG: Record<string, "success" | "warning" | "info" | "danger"> = {
  sent: "success",
  processing: "warning",
  pending: "info",
  failed: "danger"
};

const rows = ref<OutboxMessage[]>([]);
const loading = ref(false);
const total = ref(0);
const status = ref("");
const type = ref("");
const employeeId = ref<number | "">("");
const pageSize = ref(50);
const page = ref(1);
/** 待处理失败数（meta 全量口径，页头醒目提示；点击即切失败筛选） */
const failedTotal = ref(0);

/** 员工 id→姓名 映射（量级小，进页拉一次全量；含 inactive 供历史消息溯源） */
const employeeMap = ref<Map<number, string>>(new Map());
const employeeOptions = ref<Employee[]>([]);

/** 批量重试跟随当前筛选（type/employeeId），确认框中明示范围 */
const failedCountInFilter = computed(
  () => rows.value.filter((row) => row.status === "failed").length
);

watch([status, type, employeeId, pageSize], () => {
  page.value = 1;
  load();
});

function employeeName(id: number): string {
  return employeeMap.value.get(id) ?? `#${id}`;
}

/** 员工筛选值 → 请求参数：el-select 清除后是 undefined/null（valueOnClear），统一兜成不传，避免 Number(undefined)=NaN 报参数格式错误 */
function numericEmployeeId(): number | undefined {
  const value = employeeId.value;
  return value === "" || value == null ? undefined : Number(value);
}

async function load() {
  loading.value = true;
  try {
    const result = await outboxPaged({
      page: page.value,
      pageSize: pageSize.value,
      status: status.value || undefined,
      type: type.value || undefined,
      employeeId: numericEmployeeId()
    });
    rows.value = result.data;
    total.value = result.meta.total;
  } catch (error) {
    ElMessage.error(apiErrorMsg(error, "加载消息列表失败"));
  } finally {
    loading.value = false;
  }
}

async function loadEmployees() {
  try {
    employeeOptions.value = await employees();
    employeeMap.value = new Map(employeeOptions.value.map((item) => [item.id, item.name]));
  } catch {
    // 姓名映射失败不阻塞列表（降级显示 #id）
  }
}

async function retryOne(row: OutboxMessage) {
  try {
    await ElMessageBox.confirm(
      `确认重试「${employeeName(row.employeeId)}」的${TYPE_TEXT[row.type] ?? row.type}消息？将重新投递到企微。`,
      "重试消息",
      { type: "warning", confirmButtonText: "重试", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  try {
    await retryOutboxOne(row.id);
    ElMessage.success("已重置为待发送，worker 将自动重新投递");
    await load();
  } catch (error) {
    ElMessage.error(apiErrorMsg(error, "重试失败"));
  }
}

async function retryFailedBatch() {
  const scope = [
    type.value ? `类型=${TYPE_TEXT[type.value] ?? type.value}` : "",
    numericEmployeeId() != null ? `员工=${employeeName(numericEmployeeId()!)}` : ""
  ].filter(Boolean).join("、");
  try {
    await ElMessageBox.confirm(
      `确认批量重试全部发送失败的消息${scope ? `（当前筛选：${scope}）` : ""}？它们将重置为待发送并自动重新投递。`,
      "批量重试",
      { type: "warning", confirmButtonText: "批量重试", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  try {
    const result = await retryOutboxFailed({
      type: type.value || undefined,
      employeeId: numericEmployeeId()
    });
    ElMessage.success(`已重置 ${result.count} 条失败消息`);
    await load();
  } catch (error) {
    ElMessage.error(apiErrorMsg(error, "批量重试失败"));
  }
}

onMounted(() => {
  load();
  loadEmployees();
  loadMeta();
});

async function loadMeta() {
  try {
    failedTotal.value = Number((await outboxMeta()).failed || 0);
  } catch {
    /* 统计失败不阻塞列表 */
  }
}
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <span class="panel-bar" />
      <h3 class="panel-title">通知中心</h3>
      <span class="panel-sub">站内通知与企微推送共用队列；发送失败时在此归因并人工重发</span>
      <span class="filter-spacer" />
      <el-tooltip content="当前发送失败、等待人工处理的消息总数（重试成功后消失）" placement="top">
        <el-button
          v-if="failedTotal > 0"
          link
          type="danger"
          @click="status = 'failed'"
        >
          发送失败 {{ failedTotal }} 条，点击处理
        </el-button>
      </el-tooltip>
    </div>

    <div class="panel-body">
      <div class="filter-bar">
        <el-select v-model="status" placeholder="状态" class="filter-item filter-item--md">
          <el-option value="" label="全部状态" />
          <el-option value="pending" label="待发送" />
          <el-option value="processing" label="发送中" />
          <el-option value="sent" label="已发送" />
          <el-option value="failed" label="发送失败" />
        </el-select>
        <el-select v-model="type" placeholder="消息类型" class="filter-item filter-item--md">
          <el-option value="" label="全部类型" />
          <el-option v-for="(label, key) in TYPE_TEXT" :key="key" :value="key" :label="label" />
        </el-select>
        <el-select
          v-model="employeeId"
          placeholder="员工"
          filterable
          clearable
          class="filter-item filter-item--md"
        >
          <el-option
            v-for="item in employeeOptions"
            :key="item.id"
            :value="item.id"
            :label="`${item.name}（${item.wecomUserId}）`"
          />
        </el-select>
        <el-select v-model="pageSize" placeholder="每页" class="filter-item filter-item--sm">
          <el-option :value="20" label="20 / 页" />
          <el-option :value="50" label="50 / 页" />
          <el-option :value="100" label="100 / 页" />
        </el-select>
        <span class="filter-spacer" />
        <el-tooltip
          content="将所有发送失败的消息重置为待发送并自动重新投递（跟随当前类型/员工筛选）"
          placement="top"
        >
          <el-button type="warning" plain :disabled="failedCountInFilter === 0" @click="retryFailedBatch">
            批量重试失败消息
          </el-button>
        </el-tooltip>
      </div>

      <el-table :data="rows" border v-loading="loading">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-body">
              <p class="expand-line"><b>失败原因全文：</b>{{ row.failReason || "—" }}</p>
              <p class="expand-line"><b>消息体：</b><code class="payload-code">{{ row.payload }}</code></p>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="员工" width="140">
          <template #default="{ row }">{{ employeeName(row.employeeId) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ TYPE_TEXT[row.type] ?? row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="STATUS_TAG[row.status] ?? 'info'">
              {{ STATUS_TEXT[row.status] ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="retryCount" label="重试" width="70" align="center" />
        <el-table-column label="失败原因" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">
            <span :class="{ 'fail-text': row.failReason }">{{ row.failReason || "—" }}</span>
          </template>
        </el-table-column>
        <el-table-column label="入队时间" width="190">
          <template #default="{ row }">{{ formatTimeText(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'failed'"
              link
              type="primary"
              @click="retryOne(row)"
            >
              重试
            </el-button>
            <span v-else>—</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="(p: number) => { page = p; load(); }"
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

.panel-sub {
  font-size: 12px;
  color: var(--color-text-secondary);
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

.filter-spacer {
  flex: 1;
}

.fail-text {
  color: var(--el-color-danger, #f56c6c);
}

.expand-body {
  padding: 4px 16px 12px 48px;
}

.expand-line {
  margin: 6px 0;
  font-size: 13px;
  color: var(--color-text-primary);
  word-break: break-all;
}

.payload-code {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  background: var(--color-bg-page);
  padding: 2px 6px;
  border-radius: 4px;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
