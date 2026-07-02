<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Search } from "@element-plus/icons-vue";
import { api } from "../api";

const employees = ref([]);
const loading = ref(false);
const keyword = ref("");
const selectedEmployeeId = ref(null);
const selectedDepartmentId = ref("");
const meta = reactive({ page: 1, pageSize: 10 });

const adjustDialog = reactive({
  visible: false,
  submitting: false,
  employeeId: null,
  employeeName: "",
  type: "reward",
  pointsDelta: 10,
  remark: ""
});

const drawer = reactive({
  visible: false,
  loading: false,
  employeeId: null,
  employeeName: "",
  rows: [],
  meta: { total: 0, page: 1, pageSize: 20 }
});

const filtered = computed(() => {
  const key = String(keyword.value || "").trim().toLowerCase();
  const items = employees.value.slice();
  items.sort((a, b) => Number(b.pointsBalance || 0) - Number(a.pointsBalance || 0));
  if (!key) return items;
  return items.filter((item) => {
    const name = String(item.name || "").toLowerCase();
    const id = String(item.id || "");
    const dep = String(item.departmentId || "").toLowerCase();
    return name.includes(key) || id.includes(key) || dep.includes(key);
  });
});

const total = computed(() => filtered.value.length);

const pagedData = computed(() => {
  const start = (meta.page - 1) * meta.pageSize;
  return filtered.value.slice(start, start + meta.pageSize);
});

watch(filtered, () => {
  const maxPage = Math.ceil(filtered.value.length / meta.pageSize) || 1;
  if (meta.page > maxPage) meta.page = maxPage;
});

const employeeOptions = computed(() =>
  employees.value.slice().sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
);

const departmentOptions  = computed(() => {

})

function formatStatus(value) {
  const status = String(value || "");
  if (status === "active") return "在职";
  if (status === "inactive") return "停用";
  return status || "";
}

function formatType(value) {
  const type = String(value || "");
  if (type === "reward") return "加分";
  if (type === "penalty") return "扣分";
  if (type === "performance") return "绩效";
  if (type === "exchange") return "兑换";
  if (type === "refund") return "退分";
  if (type === "reversal") return "冲正";
  return type || "";
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function avatarColor(name) {
  const palette = [
    "#409EFF", "#67C23A", "#E6A23C", "#F56C6C",
    "#9B59B6", "#1ABC9C", "#2ECC71", "#3498DB",
    "#E74C3C", "#F39C12", "#8E44AD", "#16A085",
    "#D35400", "#2980B9", "#27AE60", "#C0392B"
  ];
  const s = String(name || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

async function loadEmployees() {
  loading.value = true;
  try {
    employees.value = await api.employees();
    if (employees.value.length && selectedEmployeeId.value == null) selectedEmployeeId.value = employees.value[0].id;
  } finally {
    loading.value = false;
  }
}

function openAdjust(employee) {
  adjustDialog.employeeId = employee.id;
  adjustDialog.employeeName = employee.name;
  adjustDialog.type = "reward";
  adjustDialog.pointsDelta = 10;
  adjustDialog.remark = "";
  adjustDialog.visible = true;
}

async function submitAdjust() {
  const remark = String(adjustDialog.remark || "").trim();
  if (!remark) {
    ElMessage.warning("备注原因不能为空");
    return;
  }
  const points = Number(adjustDialog.pointsDelta);
  if (!Number.isFinite(points) || points <= 0) {
    ElMessage.warning("积分必须为正数");
    return;
  }
  adjustDialog.submitting = true;
  try {
    const normalizedPointsDelta =
      adjustDialog.type === "penalty" ? -Math.abs(points) : Math.abs(points);
    await api.adjustment({
      employeeId: adjustDialog.employeeId,
      type: adjustDialog.type,
      pointsDelta: normalizedPointsDelta,
      remark
    });
    ElMessage.success("积分已提交");
    adjustDialog.visible = false;
    await loadEmployees();
    if (drawer.visible && drawer.employeeId === adjustDialog.employeeId) await loadRecords({ reset: true });
  } catch (error) {
    ElMessage.error(error?.message || "提交失败");
  } finally {
    adjustDialog.submitting = false;
  }
}

function openDrawer(employee) {
  drawer.employeeId = employee.id;
  drawer.employeeName = employee.name;
  drawer.meta.page = 1;
  drawer.meta.pageSize = 20;
  drawer.visible = true;
  loadRecords({ reset: true });
}

async function loadRecords({ reset } = {}) {
  if (!drawer.employeeId) return;
  drawer.loading = true;
  try {
    if (reset) {
      drawer.rows = [];
      drawer.meta.page = 1;
    }
    const result = await api.reportsPaged({
      page: drawer.meta.page,
      pageSize: drawer.meta.pageSize,
      employeeId: drawer.employeeId
    });
    drawer.rows = result.data;
    drawer.meta.total = result.meta.total;
  } finally {
    drawer.loading = false;
  }
}

onMounted(async () => {
  await loadEmployees();
});
</script>

<template>
  <h1 class="page-title">员工积分</h1>
  <el-card class="panel">
    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px">
      <el-input :prefix-icon="Search" v-model="keyword" placeholder="搜索员工姓名/ID" style="width: 260px" clearable />
      <el-select v-model="selectedEmployeeId" clearable placeholder="快速定位员工" style="width: 260px">
        <el-option v-for="item in employeeOptions" :key="item.id" :label="`${item.name} (${item.id})`" :value="item.id" />
      </el-select>
      <el-select v-model="selectedDepartmentId" clearable placeholder="快速定位部门" style="width: 260px">
        <el-option v-for="item in departmentOptions" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-button @click="loadEmployees" :loading="loading">刷新</el-button>
    </div>
  </el-card>

  <el-card>
    <el-table :data="pagedData" v-loading="loading" row-key="id" highlight-current-row @current-change="(row) => (selectedEmployeeId = row?.id ?? null)">
      <el-table-column prop="id" label="员工ID" min-width="100" />
      <el-table-column label="姓名" min-width="120">
        <template #default="{ row }">
          <div style="display: flex; align-items: center; gap: 10px">
            <div class="nameAvatar" :style="{ backgroundColor: avatarColor(row.name) }">
              {{ String(row.name || '').charAt(0) }}
            </div>
            <span>{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="departmentId" label="部门" min-width="100" />
      <el-table-column prop="pointsBalance" label="当前积分" min-width="120" />
      <el-table-column prop="status" label="状态" min-width="100">
        <template #default="{ row }">
          <div style="display: flex; align-items: center; gap: 6px">
            <span
              :style="{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: row.status === 'active' ? '#52c41a' : '#d9d9d9'
              }"
            />
            <span :style="{ color: row.status === 'active' ? '#52c41a' : '#999' }">
              {{ formatStatus(row.status) }}
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="350">
        <template #default="{ row }">
          <el-button plain size="small" color="#003d9b" @click="openAdjust(row)">加减积分</el-button>
          <el-button plain size="small" @click="openDrawer(row)">查看流水</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <div style="display: flex; justify-content: flex-end; margin-top: 12px">
      <el-pagination
        background
        layout="total, prev, pager, next, jumper"
        :total="total"
        :page-size="meta.pageSize"
        :current-page="meta.page"
        @current-change="
          (p) => {
            meta.page = p;
          }
        "
      />
  </div>

  <el-dialog v-model="adjustDialog.visible" title="积分加减" width="560px">
    <el-form label-width="100px">
      <el-form-item label="员工">
        <el-input :model-value="`${adjustDialog.employeeName} (${adjustDialog.employeeId})`" disabled />
      </el-form-item>
      <el-form-item label="变动类型">
        <el-segmented v-model="adjustDialog.type" :options="[{ value: 'reward', label: '加分' }, { value: 'penalty', label: '扣分' }]" />
      </el-form-item>
      <el-form-item label="积分">
        <el-input-number v-model="adjustDialog.pointsDelta" :min="1" />
      </el-form-item>
      <el-form-item label="备注原因" required>
        <el-input v-model="adjustDialog.remark" type="textarea" :rows="3" placeholder="例如：项目攻坚奖励、违规违纪处罚" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="adjustDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="adjustDialog.submitting" @click="submitAdjust">提交</el-button>
    </template>
  </el-dialog>

  <el-drawer v-model="drawer.visible" :title="`积分流水 · ${drawer.employeeName} (${drawer.employeeId})`" size="60%">
    <el-table :data="drawer.rows" border v-loading="drawer.loading">
      <el-table-column prop="pointsDelta" label="分值" width="120" />
      <el-table-column prop="type" label="类型" width="120">
        <template #default="{ row }">{{ formatType(row.type) }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="260" show-overflow-tooltip />
      <el-table-column prop="operatorName" label="操作人" width="140" />
      <el-table-column prop="occurredAt" label="时间" width="190">
        <template #default="{ row }">{{ formatTime(row.occurredAt) }}</template>
      </el-table-column>
    </el-table>
    <div style="display: flex; justify-content: flex-end; margin-top: 12px">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :total="drawer.meta.total"
        :page-size="drawer.meta.pageSize"
        :current-page="drawer.meta.page"
        @current-change="
          (p) => {
            drawer.meta.page = p;
            loadRecords();
          }
        "
      />
    </div>
  </el-drawer>
</template>

