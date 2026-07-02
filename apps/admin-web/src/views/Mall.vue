<script setup>
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { api, authFetch } from "../api";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

const rows = ref([]);
const loading = ref(false);

const dialogVisible = ref(false);
const saving = ref(false);
const editId = ref(null);
const coverImageUrl = ref("");

const form = reactive({
  name: "",
  pointsCost: 0,
  stock: 0,
  limitPerUser: null,
  status: "inactive"
});

function resetForm() {
  form.name = "";
  form.pointsCost = 0;
  form.stock = 0;
  form.limitPerUser = null;
  form.status = "inactive";
  coverImageUrl.value = "";
  editId.value = null;
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row) {
  editId.value = row.id;
  form.name = row.name || "";
  form.pointsCost = Number(row.pointsCost || 0);
  form.stock = Number(row.stock || 0);
  form.limitPerUser = row.limitPerUser == null ? null : Number(row.limitPerUser);
  form.status = String(row.status || "inactive");
  coverImageUrl.value = row.coverImageUrl || "";
  dialogVisible.value = true;
}

function formatStatus(value) {
  if (value === "active") return "上架";
  if (value === "inactive") return "下架";
  return String(value || "");
}

async function load() {
  loading.value = true;
  try {
    rows.value = await api.mallGifts();
  } finally {
    loading.value = false;
  }
}

async function save() {
  const name = String(form.name || "").trim();
  if (!name) return ElMessage.error("请填写礼品名称");
  if (!Number.isFinite(Number(form.pointsCost)) || Number(form.pointsCost) <= 0) return ElMessage.error("所需积分必须大于 0");
  if (!Number.isFinite(Number(form.stock)) || Number(form.stock) < 0) return ElMessage.error("库存不能为负数");

  saving.value = true;
  try {
    if (editId.value) {
      const updated = await api.updateGift(editId.value, {
        name,
        pointsCost: form.pointsCost,
        stock: form.stock,
        limitPerUser: form.limitPerUser,
        status: form.status
      });
      coverImageUrl.value = updated.coverImageUrl || coverImageUrl.value;
      ElMessage.success("已保存");
    } else {
      const created = await api.createGift({
        name,
        pointsCost: form.pointsCost,
        stock: form.stock,
        limitPerUser: form.limitPerUser,
        status: form.status
      });
      editId.value = created.id;
      coverImageUrl.value = created.coverImageUrl || "";
      ElMessage.success("已创建");
    }
    await load();
  } finally {
    saving.value = false;
  }
}

async function publish(row) {
  try {
    await ElMessageBox.confirm(`确认上架「${row.name}」？`, "确认操作", { type: "warning" });
  } catch {
    return;
  }
  await api.publishGift(row.id);
  ElMessage.success("已上架");
  await load();
}

async function unpublish(row) {
  try {
    await ElMessageBox.confirm(`确认下架「${row.name}」？`, "确认操作", { type: "warning" });
  } catch {
    return;
  }
  await api.unpublishGift(row.id);
  ElMessage.success("已下架");
  await load();
}

async function uploadCover(options) {
  if (!editId.value) {
    options.onError?.(new Error("请先保存礼品信息，再上传封面"));
    return;
  }
  const data = new FormData();
  data.append("file", options.file);
  try {
    const response = await authFetch(`${API_BASE}/admin/mall/gifts/${editId.value}/cover`, {
      method: "POST",
      body: data
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "上传失败");
    const updated = result.data || result;
    coverImageUrl.value = updated.coverImageUrl || "";
    options.onSuccess?.(updated, options.file);
    ElMessage.success("封面已更新");
    await load();
  } catch (error) {
    options.onError?.(error);
    ElMessage.error(error?.message || "上传失败");
  }
}

onMounted(load);
</script>

<template>
  <h1 class="page-title">商城礼品</h1>
  <el-card class="panel">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px">
      <div style="color: var(--el-text-color-secondary)">支持新增/编辑/上下架/上传封面图</div>
      <el-button type="primary" @click="openCreate">新增礼品</el-button>
    </div>

    <el-table :data="rows" border v-loading="loading">
      <el-table-column label="封面" width="110">
        <template #default="{ row }">
          <el-image
            v-if="row.coverImageUrl"
            :src="`${API_BASE}${row.coverImageUrl}`"
            style="width: 80px; height: 80px; border-radius: 6px"
            fit="cover"
          />
          <el-tag v-else type="info">无</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="礼品" min-width="220" />
      <el-table-column prop="pointsCost" label="所需积分" width="120" />
      <el-table-column prop="stock" label="库存" width="100" />
      <el-table-column prop="limitPerUser" label="限购" width="100">
        <template #default="{ row }">{{ row.limitPerUser == null ? "不限" : `${row.limitPerUser} / 人` }}</template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'warning'">{{ formatStatus(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="row.status !== 'active'" size="small" type="success" @click="publish(row)">上架</el-button>
          <el-button v-else size="small" type="warning" @click="unpublish(row)">下架</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="dialogVisible" :title="editId ? '编辑礼品' : '新增礼品'" width="520px">
    <el-form label-width="90px">
      <el-form-item label="礼品名称">
        <el-input v-model="form.name" placeholder="例如：京东购物卡 100 元" />
      </el-form-item>
      <el-form-item label="所需积分">
        <el-input-number v-model="form.pointsCost" :min="1" :max="999999" style="width: 100%" />
      </el-form-item>
      <el-form-item label="库存">
        <el-input-number v-model="form.stock" :min="0" :max="999999" style="width: 100%" />
      </el-form-item>
      <el-form-item label="限购">
        <el-input-number v-model="form.limitPerUser" :min="1" :max="999999" style="width: 100%" placeholder="为空表示不限购" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="form.status" style="width: 100%">
          <el-option value="inactive" label="下架" />
          <el-option value="active" label="上架" />
        </el-select>
      </el-form-item>

      <el-form-item label="封面图">
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
          <el-image
            v-if="coverImageUrl"
            :src="`${API_BASE}${coverImageUrl}`"
            style="width: 84px; height: 84px; border-radius: 8px"
            fit="cover"
          />
          <el-upload
            :show-file-list="false"
            accept="image/*"
            :limit="1"
            :http-request="uploadCover"
          >
            <el-button :disabled="!editId">选择图片并上传</el-button>
          </el-upload>
          <el-tag v-if="!editId" type="info">先保存礼品后才能上传封面</el-tag>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button
        @click="
          dialogVisible = false;
          resetForm();
        "
      >
        关闭
      </el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>
