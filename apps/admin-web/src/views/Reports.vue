<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { api, authFetch } from "../api";

const rows = ref([]);
const downloading = ref(false);
const loading = ref(false);
const employees = ref([]);
const meta = reactive({ total: 0, page: 1, pageSize: 50 });
const query = reactive({ employeeId: "", month: "" });

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatType(value) {
  const type = String(value || "");
  if (type === "reward") return "加分";
  if (type === "penalty") return "扣分";
  if (type === "performance") return "绩效";
  if (type === "exchange") return "兑换";
  if (type === "refund") return "退分";
  if (type === "reversal") return "冲正";
  return type;
}

async function load() {
  loading.value = true;
  try {
    const result = await api.reportsPaged({
      page: meta.page,
      pageSize: meta.pageSize,
      employeeId: query.employeeId,
      month: query.month
    });
    rows.value = result.data;
    meta.total = result.meta.total;
  } finally {
    loading.value = false;
  }
}

watch(
  () => [query.employeeId, query.month, meta.pageSize],
  () => {
    meta.page = 1;
    load();
  }
);

onMounted(async () => {
  employees.value = await api.employees();
  await load();
});

async function downloadXlsx() {
  downloading.value = true;
  try {
    const base = import.meta.env.VITE_API_BASE || "http://localhost:3000";
    const qs = new URLSearchParams();
    if (query.employeeId) qs.set("employeeId", query.employeeId);
    if (query.month) qs.set("month", query.month);
    const response = await authFetch(
      `${base}/admin/reports/point-records.xlsx${qs.toString() ? `?${qs}` : ""}`
    );
    if (!response.ok) throw new Error("下载失败");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `point-records-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <h1 class="page-title">明细报表</h1>
  <el-card class="panel">
    <div style="margin-bottom: 12px">
      <el-button type="primary" :loading="downloading" @click="downloadXlsx">导出 Excel</el-button>
    </div>
    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px">
      <el-select v-model="query.employeeId" clearable placeholder="员工">
        <el-option v-for="item in employees" :key="item.id" :label="item.name" :value="String(item.id)" />
      </el-select>
      <el-input v-model="query.month" placeholder="月份（YYYY-MM）" style="width: 160px" clearable />
      <el-select v-model="meta.pageSize" placeholder="每页" style="width: 120px">
        <el-option :value="20" label="20 / 页" />
        <el-option :value="50" label="50 / 页" />
        <el-option :value="100" label="100 / 页" />
      </el-select>
    </div>

    <el-table :data="rows" border v-loading="loading">
      <el-table-column prop="employeeName" label="员工" width="120" />
      <el-table-column prop="pointsDelta" label="分值" width="100" />
      <el-table-column label="类型" width="140">
        <template #default="{ row }">{{ formatType(row.type) }}</template>
      </el-table-column>
      <el-table-column prop="operatorName" label="操作人" width="140" />
      <el-table-column prop="occurredAt" label="时间" width="210">
        <template #default="{ row }">{{ formatTime(row.occurredAt) }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注原因" min-width="260" />
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
</template>
