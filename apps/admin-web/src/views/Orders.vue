<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api } from "../api";

const rows = ref([]);
const loading = ref(false);
const meta = reactive({ total: 0, page: 1, pageSize: 50 });
const employees = ref([]);
const query = reactive({ status: "", employeeId: "" });

const employeeNameMap = computed(() => {
  const map = new Map();
  for (const item of employees.value) map.set(String(item.id), item.name);
  return map;
});

function formatEmployee(value) {
  if (value == null) return "";
  return employeeNameMap.value.get(String(value)) || String(value);
}

async function load() {
  loading.value = true;
  try {
    const result = await api.ordersPaged({
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

async function setStatus(row, status) {
  let remark = "后台审核处理";
  if (status === "rejected" || status === "cancelled") {
    try {
      const result = await ElMessageBox.prompt("请输入处理备注（必填）", status === "rejected" ? "驳回退分" : "取消订单", {
        confirmButtonText: "提交",
        cancelButtonText: "取消",
        inputType: "textarea",
        inputPlaceholder: "例如：库存不足、信息不完整、重复下单等",
        inputValidator: (value) => {
          if (!String(value || "").trim()) return "备注不能为空";
          return true;
        }
      });
      remark = String(result.value || "").trim();
    } catch {
      return;
    }
  }

  await api.updateOrder(row.id, { status, remark });
  ElMessage.success("订单状态已更新");
  meta.page = 1;
  await load();
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatStatus(value) {
  const status = String(value || "");
  if (status === "pending_review") return "待审核";
  if (status === "approved") return "审核通过";
  if (status === "shipped") return "已发货";
  if (status === "rejected") return "已驳回";
  if (status === "cancelled") return "已取消";
  if (status === "completed") return "已完成";
  return status;
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
  <h1 class="page-title">订单核销</h1>
  <el-card class="panel">
    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px">
      <el-select v-model="query.status" clearable placeholder="状态" style="width: 240px">
        <el-option value="pending_review" label="待审核" />
        <el-option value="approved" label="审核通过" />
        <el-option value="shipped" label="已发货" />
        <el-option value="rejected" label="驳回" />
        <el-option value="cancelled" label="取消" />
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
      <el-table-column label="员工" width="140">
        <template #default="{ row }">{{ formatEmployee(row.employeeId) }}</template>
      </el-table-column>
      <el-table-column prop="giftName" label="礼品" />
      <el-table-column prop="pointsCost" label="积分" width="100" />
      <el-table-column label="状态" width="160">
        <template #default="{ row }">{{ formatStatus(row.status) }}</template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="200">
        <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="260">
        <template #default="{ row }">
          <el-button size="small" @click="setStatus(row, 'approved')">审核通过</el-button>
          <el-button size="small" @click="setStatus(row, 'shipped')">发货</el-button>
          <el-button size="small" type="danger" @click="setStatus(row, 'rejected')">驳回退分</el-button>
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
</template>
