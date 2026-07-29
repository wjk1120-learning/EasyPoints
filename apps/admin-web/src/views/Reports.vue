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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
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
  <div class="report-page">
    <div class="panel">
      <!-- 面板头部 -->
      <div class="panel-head">
        <span class="panel-bar" />
        <h3 class="panel-title">积分明细报表</h3>
        <div class="panel-head-extra">
          <el-button type="primary" :loading="downloading" class="btn-export" @click="downloadXlsx">
            导出 Excel
          </el-button>
        </div>
      </div>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <el-select v-model="query.employeeId" clearable placeholder="选择员工" class="filter-item">
          <el-option v-for="item in employees" :key="item.id" :label="item.name" :value="String(item.id)" />
        </el-select>
        <el-date-picker v-model="query.month" type="month" placeholder="月份（YYYY-MM）" value-format="YYYY-MM" clearable class="filter-item filter-month" />
        <el-select v-model="meta.pageSize" placeholder="每页条数" class="filter-item filter-page-size">
          <el-option :value="20" label="20 条 / 页" />
          <el-option :value="50" label="50 条 / 页" />
          <el-option :value="100" label="100 条 / 页" />
        </el-select>
      </div>

      <!-- 表格 -->
      <div class="table-wrap">
        <el-table :data="rows" border v-loading="loading" class="report-table">
          <el-table-column prop="employeeName" label="员工" width="120" />
          <el-table-column prop="pointsDelta" label="分值" width="100" />
          <el-table-column label="类型" width="140">
            <template #default="{ row }">
              <el-tag :type="row.type === 'reward' ? 'success' : row.type === 'penalty' ? 'danger' : 'info'" size="small" effect="plain">
                {{ formatType(row.type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="operatorName" label="操作人" width="140" />
          <el-table-column prop="occurredAt" label="时间" width="210">
            <template #default="{ row }">{{ formatTime(row.occurredAt) }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注原因" min-width="260" show-overflow-tooltip />
        </el-table>
      </div>

      <!-- 底部分页 -->
      <div class="pagination-bar">
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
    </div>
  </div>
</template>

<style scoped lang="scss">
// ==============================
// 页面容器
// ==============================
.report-page {
  height: 100%;
}

// ==============================
// 面板
// ==============================
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8eaee;
  overflow: hidden;
}

// ==============================
// 面板头部
// ==============================
.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: #fafbfc;
  border-bottom: 1px solid #e8eaee;
  flex-shrink: 0;
}

.panel-bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  background: #0056c1;
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #181a23;
}

.panel-head-extra {
  margin-left: auto;
}

// 导出按钮
.btn-export {
  border-radius: 6px;
  font-weight: 500;
  background-color: #0056c1;
  border-color: #0056c1;
  transition: all 0.2s;

  &:hover {
    background-color: #003d9b;
    border-color: #003d9b;
  }

  &:active {
    background-color: #002b7a;
    border-color: #002b7a;
  }
}

// ==============================
// 筛选栏
// ==============================
.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 16px 20px;
  border-bottom: 1px solid #e8eaee;
}

.filter-item {
  width: 200px;
}

.filter-month {
  width: 160px;
}

.filter-page-size {
  width: 140px;
}

// ==============================
// 表格容器
// ==============================
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 20px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #d0d5dd;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #a8abb2;
  }
}

// ==============================
// 表格样式
// ==============================
.report-table {
  width: 100%;

  :deep(.el-table__header th) {
    background: #f4f7fc;
    color: #414654;
    font-weight: 600;
    font-size: 13px;
  }

  :deep(.el-table__row) {
    transition: background 0.15s;

    &:hover > td {
      background: #f8faff;
    }
  }
}

// ==============================
// 底部分页
// ==============================
.pagination-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid #e8eaee;
  background: #fafbfc;
}
</style>
