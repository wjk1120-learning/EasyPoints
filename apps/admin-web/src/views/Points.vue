<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { api } from "../api";

const employees = ref([]);
const single = reactive({ employeeId: null, pointsDelta: 10, type: "reward", remark: "" });
const batch = reactive({
  month: "2026-06",
  batchRemark: "",
  items: []
});

const employeeNameMap = computed(() => {
  const map = new Map();
  for (const item of employees.value) map.set(String(item.id), item.name);
  return map;
});

function formatEmployee(value) {
  if (value == null) return "";
  return employeeNameMap.value.get(String(value)) || String(value);
}

onMounted(async () => {
  employees.value = await api.employees();
  if (employees.value.length && single.employeeId == null) single.employeeId = employees.value[0].id;
  batch.items = employees.value.map((item) => ({ employeeId: item.id, pointsDelta: 0, remark: "" }));
});

async function submitSingle() {
  const points = Number(single.pointsDelta);
  const normalizedPointsDelta = single.type === "penalty" ? -Math.abs(points) : Math.abs(points);
  await api.adjustment({ ...single, pointsDelta: normalizedPointsDelta });
  ElMessage.success("单笔积分已提交，备注已写入流水");
  single.remark = "";
}

async function submitBatch() {
  await api.monthlyBatch(batch);
  ElMessage.success("月度批量录分已提交");
}
</script>

<template>
  <h1 class="page-title">积分录入</h1>
  <el-card class="panel">
    <template #header>单笔奖惩加减分</template>
    <el-form :model="single" label-width="110px">
      <el-form-item label="员工">
        <el-select v-model="single.employeeId">
          <el-option v-for="item in employees" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="变动类型">
        <el-segmented v-model="single.type" :options="[{ value: 'reward', label: '加分' }, { value: 'penalty', label: '扣分' }]" />
      </el-form-item>
      <el-form-item label="积分">
        <el-input-number v-model="single.pointsDelta" />
      </el-form-item>
      <el-form-item label="备注原因" required>
        <el-input v-model="single.remark" type="textarea" :rows="3" placeholder="例如：项目攻坚奖励、违规违纪处罚" />
      </el-form-item>
      <el-button type="primary" @click="submitSingle">提交单笔积分</el-button>
    </el-form>
  </el-card>

  <el-card class="panel">
    <template #header>月度批量录分</template>
    <el-form :model="batch" label-width="110px">
      <el-form-item label="月份"><el-input v-model="batch.month" /></el-form-item>
      <el-form-item label="统一备注"><el-input v-model="batch.batchRemark" type="textarea" :rows="2" /></el-form-item>
      <el-table :data="batch.items" border>
        <el-table-column label="员工" width="180">
          <template #default="{ row }">{{ formatEmployee(row.employeeId) }}</template>
        </el-table-column>
        <el-table-column label="积分" width="180">
          <template #default="{ row }"><el-input-number v-model="row.pointsDelta" /></template>
        </el-table-column>
        <el-table-column label="单人备注">
          <template #default="{ row }"><el-input v-model="row.remark" placeholder="留空则使用统一备注" /></template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 14px">
        <el-button type="primary" @click="submitBatch">提交月度录分</el-button>
      </div>
    </el-form>
  </el-card>
</template>
