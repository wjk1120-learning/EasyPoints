<script setup lang="ts">
/**
 * 审核工单详情描述列表：兑换/任务/积分申请/申诉四类工单共用（PRD 5.2）。
 * 每行字段按 type 渲染：text 普通文本 / time 时间 / delta 带语义色分值 / images 佐证图片预览。
 */
import { computed } from "vue";
import { formatTimeText } from "../utils/format";

export interface WorkOrderField {
  label: string;
  /** 文本值（text/time/delta 类型使用） */
  value?: string | number | null;
  /** delta 数值正负号按积分语义色渲染 */
  type?: "text" | "time" | "delta" | "images";
  /** 佐证图片 URL 列表（images 类型使用） */
  images?: string[];
}

const props = defineProps<{ fields: WorkOrderField[] }>();

const rows = computed(() =>
  props.fields.map((field) => ({
    ...field,
    displayText:
      field.type === "time"
        ? formatTimeText(field.value)
        : field.value === null || field.value === undefined || field.value === ""
          ? "—"
          : String(field.value)
  }))
);

function deltaClass(value: string | number | null | undefined): string {
  const num = Number(value || 0);
  return num >= 0 ? "delta-add" : "delta-deduct";
}

function deltaText(value: string | number | null | undefined): string {
  const num = Number(value || 0);
  return `${num > 0 ? "+" : ""}${num}`;
}
</script>

<template>
  <el-descriptions :column="1" border class="work-order-detail">
    <el-descriptions-item v-for="row in rows" :key="row.label" :label="row.label" :label-width="110">
      <template v-if="row.type === 'delta'">
        <span :class="['delta-text', deltaClass(row.value)]">{{ deltaText(row.value) }}</span>
      </template>
      <template v-else-if="row.type === 'images'">
        <div v-if="row.images && row.images.length" class="image-list">
          <el-image
            v-for="(img, index) in row.images"
            :key="img"
            :src="img"
            :initial-index="index"
            :preview-src-list="row.images"
            preview-teleported
            fit="cover"
            class="evidence-image"
          />
        </div>
        <span v-else class="text-secondary">无佐证图片</span>
      </template>
      <template v-else>{{ row.displayText }}</template>
    </el-descriptions-item>
  </el-descriptions>
</template>

<style scoped lang="scss">
.work-order-detail {
  width: 100%;
}

.delta-text {
  font-weight: 600;
}

.delta-add {
  color: var(--color-points-add);
}

.delta-deduct {
  color: var(--color-points-deduct);
}

.image-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.evidence-image {
  width: 84px;
  height: 84px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.text-secondary {
  color: var(--color-text-secondary);
}
</style>
