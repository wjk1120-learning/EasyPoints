<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { api } from "../api";

const rows = ref([]);
const loading = ref(false);
const meta = reactive({ total: 0, page: 1, pageSize: 50 });
const employees = ref([]);
const query = reactive({ status: "", employeeId: "" });

const processing = ref(false);
const dialogVisible = ref(false);
const selectedRow = ref(null);
const form = reactive({ decision: "department_approved", remark: "" });

const employeeNameMap = computed(() => {
  const map = new Map();
  for (const item of employees.value) map.set(String(item.id), item.name);
  return map;
});

function formatEmployee(row) {
  if (row?.employeeName) return row.employeeName;
  if (row?.employeeId != null) return employeeNameMap.value.get(String(row.employeeId)) || String(row.employeeId);
  return "";
}

async function load() {
  loading.value = true;
  try {
    const result = await api.appealsPaged({
      page: meta.page,
      pageSize: meta.pageSize,
      status: query.status,
      employeeId: query.employeeId
    });
    rows.value = result.data;
    meta.total = result.meta.total;
  } finally {
    loading.value = false;
  }
}

function openProcess(row) {
  selectedRow.value = row;
  form.decision = "department_approved";
  form.remark = "";
  dialogVisible.value = true;
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
    await api.reviewAppeal(selectedRow.value.id, {
      status: form.decision,
      stage: form.decision === "hr_approved" ? "hr" : "department",
      resultRemark: remark
    });
    ElMessage.success("已处理");
    closeDialog();
    meta.page = 1;
    await load();
  } finally {
    processing.value = false;
  }
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatStatus(value) {
  const status = String(value || "");
  if (status === "pending_department_review" || status === "pending_hr_review") return "待处理";
  if (!status) return "";
  return "已处理";
}

function formatEvent(row) {
  const record = row?.pointRecord;
  if (!record) return row?.pointRecordId != null ? String(row.pointRecordId) : "";
  const delta = Number(record.pointsDelta || 0);
  const deltaText = `${delta > 0 ? "+" : ""}${delta}`;
  const remark = String(record.remark || "").trim();
  if (!remark) return deltaText;
  return `${remark}（${deltaText}）`;
}

onMounted(async () => {
  employees.value = await api.employees();
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
  <h1 class="page-title">申诉审核</h1>
  <el-card class="panel">
    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px">
      <el-select v-model="query.status" clearable placeholder="状态" style="width: 240px">
        <el-option value="pending_department_review" label="待初审" />
        <el-option value="department_approved" label="初审通过" />
        <el-option value="hr_approved" label="人事通过" />
        <el-option value="rejected" label="驳回" />
      </el-select>
      <el-select v-model="query.employeeId" clearable placeholder="员工" style="width: 240px">
        <el-option v-for="item in employees" :key="item.id" :label="item.name" :value="String(item.id)" />
      </el-select>
      <el-select v-model="meta.pageSize" placeholder="每页" style="width: 120px">
        <el-option :value="20" label="20 / 页" />
        <el-option :value="50" label="50 / 页" />
        <el-option :value="100" label="100 / 页" />
      </el-select>
    </div>

    <el-table :data="rows" border v-loading="loading">
      <el-table-column label="员工" width="160">
        <template #default="{ row }">{{ formatEmployee(row) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag v-if="formatStatus(row.status)" :type="formatStatus(row.status) === '待处理' ? 'warning' : 'success'">
            {{ formatStatus(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="申诉原因" />
      <el-table-column label="事件" width="280">
        <template #default="{ row }">{{ formatEvent(row) }}</template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="200">
        <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button size="small" @click="openProcess(row)">处理</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="display: flex; justify-content: flex-end; margin-top: 12px">
      <el-pagination
        background
        layout="total, prev, pager, next, jumper"
        :total="meta.total"
        :page-size="meta.pageSize"
        :current-page="meta.page"
        @current-change="
          (p) => {
            meta.page = p;
            load();
          }
        "
      />
    </div>
  </el-card>

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
</template>
