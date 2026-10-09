<script setup lang="ts">
/**
 * 申诉处理面板（PRD 5.2 / 3.3）：嵌入审核中心 Tab。
 * 一级三态闭环：仅待审核可处理；处理后工单闭环不可重复申诉。
 */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { appealsPaged, reviewAppeal } from "../../api/appeal/appeal";
import type { Appeal } from "../../api/appeal/types";
import { employees as fetchEmployees } from "../../api/employee/employee";
import type { Employee } from "../../api/employee/types";
import { APPEAL_STATUS_MAP, statusMeta } from "../../utils/status";
import { formatTimeText } from "../../utils/format";
import { pendingFirst } from "../../utils/sort";
import WorkOrderDetail from "../WorkOrderDetail.vue";
import type { WorkOrderField } from "../WorkOrderDetail.vue";

const rows = ref<Appeal[]>([]);
const loading = ref(false);
const meta = reactive({ total: 0, page: 1, pageSize: 50 });
const employees = ref<Employee[]>([]);
const query = reactive({ status: "", employeeId: "" });

const processing = ref(false);
const dialogVisible = ref(false);
const selectedRow = ref<Appeal | null>(null);
const form = reactive({ decision: "department_approved" as "department_approved" | "rejected", remark: "" });
const detailDialog = reactive({ visible: false, fields: [] as WorkOrderField[] });

const employeeNameMap = computed(() => {
  const map = new Map<string, string>();
  for (const item of employees.value) map.set(String(item.id), item.name);
  return map;
});

function formatEmployee(row: Appeal) {
  if (row?.employeeName) return row.employeeName;
  if (row?.employeeId != null) return employeeNameMap.value.get(String(row.employeeId)) || String(row.employeeId);
  return "";
}

const statusText = (value: string) => statusMeta(APPEAL_STATUS_MAP, value).text;
const statusTag = (value: string) => statusMeta(APPEAL_STATUS_MAP, value).tag;
/** 仅待审核可处理（PRD 3.3：处理后工单闭环，不可重复申诉） */
const isPending = (value: string) => String(value || "").startsWith("pending_");

function formatEvent(row: Appeal) {
  const record = row?.pointRecord;
  if (!record) return row?.pointRecordId != null ? String(row.pointRecordId) : "";
  const delta = Number(record.pointsDelta || 0);
  const deltaText = `${delta > 0 ? "+" : ""}${delta}`;
  const remark = String(record.remark || "").trim();
  if (!remark) return deltaText;
  return `${remark}（${deltaText}）`;
}

async function load() {
  loading.value = true;
  try {
    const result = await appealsPaged({
      page: meta.page,
      pageSize: meta.pageSize,
      status: query.status,
      employeeId: query.employeeId
    });
    rows.value = pendingFirst(result.data, (row) => String(row.status || "").startsWith("pending_"), (row) =>
      new Date(row.updatedAt || row.createdAt || 0).getTime()
    );
    meta.total = result.meta.total;
  } finally {
    loading.value = false;
  }
}

function openProcess(row: Appeal) {
  selectedRow.value = row;
  form.decision = "department_approved";
  form.remark = "";
  dialogVisible.value = true;
}

/** 只读详情：全程留痕信息展示（PRD 3.3 申诉全程留痕） */
function openDetail(row: Appeal) {
  detailDialog.fields = [
    { label: "申诉人", value: formatEmployee(row) },
    { label: "申诉原因", value: row.reason },
    { label: "关联流水分值", value: row.pointRecord?.pointsDelta, type: "delta" },
    { label: "关联流水备注", value: row.pointRecord?.remark || "—" },
    { label: "申诉时间", value: row.createdAt, type: "time" },
    { label: "当前状态", value: statusText(row.status) },
    { label: "处理备注", value: row.resultRemark || "—" },
    { label: "更新时间", value: row.updatedAt, type: "time" }
  ];
  detailDialog.visible = true;
}

function closeDialog() {
  dialogVisible.value = false;
  selectedRow.value = null;
  form.decision = "department_approved";
  form.remark = "";
}

async function submitProcess() {
  const remark = String(form.remark || "").trim();
  if (!remark) {
    ElMessage.warning("请填写处理备注");
    return;
  }
  if (!selectedRow.value) return;
  processing.value = true;
  try {
    // PRD 三态闭环：通过/驳回，一级审核。wire 值沿用存量后端枚举，展示层已归一（utils/status.ts）
    await reviewAppeal(selectedRow.value.id, {
      status: form.decision,
      stage: "department",
      resultRemark: remark
    });
    ElMessage.success("已处理，结果将推送员工通知");
    window.dispatchEvent(new CustomEvent("review:refresh"));
    window.dispatchEvent(new CustomEvent("badges:refresh"));
    closeDialog();
    if (meta.page > 1 && rows.value.length <= 1) meta.page = 1;
    await load();
  } catch (error) {
    ElMessage.error((error as Error)?.message || "处理失败");
  } finally {
    processing.value = false;
  }
}

onMounted(async () => {
  employees.value = await fetchEmployees();
  await load();
});

watch(
  () => [query.status, query.employeeId, meta.pageSize],
  () => {
    meta.page = 1;
    load();
  }
);
</script>

<template>
  <div class="review-panel">
    <div class="filter-bar">
      <el-select v-model="query.status" clearable placeholder="状态" class="filter-item">
        <el-option value="" label="全部" />
        <el-option value="pending_department_review" label="待审核" />
        <el-option value="department_approved" label="审核通过" />
        <el-option value="rejected" label="已驳回" />
      </el-select>
      <el-select v-model="query.employeeId" clearable placeholder="员工" class="filter-item">
        <el-option v-for="item in employees" :key="item.id" :label="item.name" :value="String(item.id)" />
      </el-select>
      <el-select v-model="meta.pageSize" placeholder="每页" class="filter-item filter-item--sm">
        <el-option :value="20" label="20 / 页" />
        <el-option :value="50" label="50 / 页" />
        <el-option :value="100" label="100 / 页" />
      </el-select>
    </div>

    <el-table :data="rows" border v-loading="loading">
      <el-table-column label="员工" width="140">
        <template #default="{ row }">{{ formatEmployee(row) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)" effect="plain">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="申诉原因" min-width="200" show-overflow-tooltip />
      <el-table-column label="事件" width="240">
        <template #default="{ row }">{{ formatEvent(row) }}</template>
      </el-table-column>
      <el-table-column label="处理备注" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.resultRemark || "—" }}</template>
      </el-table-column>
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ formatTimeText(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button v-if="isPending(row.status)" size="small" type="primary" @click="openProcess(row)">处理</el-button>
          <el-button size="small" @click="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-bar">
      <el-pagination
        background
        layout="total, prev, pager, next, jumper"
        :total="meta.total"
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

  <el-dialog v-model="dialogVisible" title="处理申诉" width="520px" @close="closeDialog">
    <el-form label-width="90px">
      <el-form-item label="处理结果">
        <el-radio-group v-model="form.decision">
          <el-radio label="department_approved">通过</el-radio>
          <el-radio label="rejected">驳回</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="处理备注" required>
        <el-input v-model="form.remark" type="textarea" :rows="4" placeholder="必须填写处理备注" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="processing" @click="submitProcess">提交</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="detailDialog.visible" title="申诉工单详情" width="560px">
    <WorkOrderDetail :fields="detailDialog.fields" />
  </el-dialog>
</template>

<style scoped lang="scss">
.review-panel {
  padding: 4px 2px 8px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.filter-item {
  width: 220px;
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
