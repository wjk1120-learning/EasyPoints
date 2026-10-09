<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { UploadRequestOptions } from "element-plus";
import { API_BASE } from "../utils/request";
import {
  createGift,
  mallGifts,
  publishGift,
  unpublishGift,
  updateGift,
  uploadGiftCover
} from "../api/mall/mall";
import type { Gift } from "../api/mall/types";
import { orders as fetchOrders } from "../api/order/order";
import type { Order } from "../api/order/types";
import { ORDER_STATUS_MAP, statusMeta } from "../utils/status";
import { formatTimeText } from "../utils/format";

const rows = ref<Gift[]>([]);
const loading = ref(false);

/** 礼品维度兑换记录抽屉（PRD 5.4：查看所有礼品兑换记录及审核状态） */
const recordsDrawer = reactive({ visible: false, loading: false, gift: null as Gift | null, rows: [] as Order[] });

const dialogVisible = ref(false);
const saving = ref(false);
const editId = ref<number | null>(null);
const coverImageUrl = ref("");

const form = reactive({
  name: "",
  pointsCost: 0,
  stock: 0,
  limitPerUser: null as number | null,
  status: "inactive" as "active" | "inactive"
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

function openEdit(row: Gift) {
  editId.value = row.id;
  form.name = row.name || "";
  form.pointsCost = Number(row.pointsCost || 0);
  form.stock = Number(row.stock || 0);
  form.limitPerUser = row.limitPerUser == null ? null : Number(row.limitPerUser);
  form.status = (String(row.status || "inactive") === "active" ? "active" : "inactive");
  coverImageUrl.value = row.coverImageUrl || "";
  dialogVisible.value = true;
}

function formatStatus(value: unknown) {
  if (value === "active") return "上架";
  if (value === "inactive") return "下架";
  return String(value || "");
}

async function load() {
  loading.value = true;
  try {
    rows.value = await mallGifts();
  } finally {
    loading.value = false;
  }
}

/** 查看该礼品的全部兑换记录及审核状态（兑换接口暂无 giftId 筛选，前端过滤，量级小） */
async function openRecords(row: Gift) {
  recordsDrawer.gift = row;
  recordsDrawer.visible = true;
  recordsDrawer.loading = true;
  try {
    const all = await fetchOrders();
    recordsDrawer.rows = all.filter((item) => String(item.giftId ?? "") === String(row.id) || item.giftName === row.name);
  } finally {
    recordsDrawer.loading = false;
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
      const updated = await updateGift(editId.value, {
        name,
        pointsCost: form.pointsCost,
        stock: form.stock,
        limitPerUser: form.limitPerUser,
        status: form.status
      });
      coverImageUrl.value = updated.coverImageUrl || coverImageUrl.value;
      ElMessage.success("已保存");
    } else {
      const created = await createGift({
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

async function publish(row: Gift) {
  try {
    await ElMessageBox.confirm(`确认上架「${row.name}」？`, "确认操作", { type: "warning" });
  } catch {
    return;
  }
  await publishGift(row.id);
  ElMessage.success("已上架");
  await load();
}

async function unpublish(row: Gift) {
  try {
    await ElMessageBox.confirm(`确认下架「${row.name}」？`, "确认操作", { type: "warning" });
  } catch {
    return;
  }
  await unpublishGift(row.id);
  ElMessage.success("已下架");
  await load();
}

type UploadHookError = Parameters<UploadRequestOptions["onError"]>[0];

function toUploadError(message: string): UploadHookError {
  return new Error(message) as unknown as UploadHookError;
}

async function uploadCover(options: UploadRequestOptions) {
  if (!editId.value) {
    options.onError?.(toUploadError("请先保存礼品信息，再上传封面"));
    return;
  }
  try {
    const updated = await uploadGiftCover(editId.value, options.file);
    coverImageUrl.value = updated.coverImageUrl || "";
    options.onSuccess?.(updated);
    ElMessage.success("封面已更新");
    await load();
  } catch (error) {
    options.onError?.(toUploadError((error as Error)?.message || "上传失败"));
    ElMessage.error((error as Error)?.message || "上传失败");
  }
}

onMounted(load);
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <span class="panel-bar" />
      <h3 class="panel-title">礼品管理</h3>
      <div class="panel-head-extra">
        <span class="panel-hint">支持新增 / 编辑 / 上下架 / 上传封面图</span>
        <el-button color="var(--color-primary)" @click="openCreate">新增礼品</el-button>
      </div>
    </div>

    <div class="panel-body">
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
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ row.createdAt ? formatTimeText(row.createdAt) : "—" }}</template>
        </el-table-column>
        <el-table-column prop="limitPerUser" label="限购" width="100">
          <template #default="{ row }">{{ row.limitPerUser == null ? "不限" : `${row.limitPerUser} / 人` }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'warning'">{{ formatStatus(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="330" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'active'" size="small" type="success" @click="publish(row)">上架</el-button>
            <el-button v-else size="small" type="warning" @click="unpublish(row)">下架</el-button>
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" @click="openRecords(row)">兑换记录</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>

  <!-- 礼品维度兑换记录 -->
  <el-drawer v-model="recordsDrawer.visible" size="55%" :title="`兑换记录 · ${recordsDrawer.gift?.name || ''}`">
    <el-table :data="recordsDrawer.rows" border v-loading="recordsDrawer.loading">
      <el-table-column label="员工" width="140">
        <template #default="{ row }">{{ row.employeeName || `员工(${row.employeeId})` }}</template>
      </el-table-column>
      <el-table-column label="消耗积分" width="110">
        <template #default="{ row }">
          <span style="color: var(--color-points-deduct); font-weight: 600">-{{ row.pointsCost }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusMeta(ORDER_STATUS_MAP, row.status).tag" effect="plain">
            {{ statusMeta(ORDER_STATUS_MAP, row.status).text }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="兑换时间" width="180">
        <template #default="{ row }">{{ formatTimeText(row.createdAt || row.updatedAt) || "—" }}</template>
      </el-table-column>
      <el-table-column label="处理备注" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.remark || "—" }}</template>
      </el-table-column>
    </el-table>
  </el-drawer>

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

<style scoped lang="scss">
// ==============================
// 面板基座
// ==============================
.panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
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
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border);
}

.panel-head-extra {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
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

.panel-hint {
  font-size: 13px;
  color: var(--color-text-placeholder);
}

// ==============================
// 面板内容
// ==============================
.panel-body {
  padding: 20px;
}
</style>
