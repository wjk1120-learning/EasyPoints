<script setup lang="ts">
/**
 * 驳回原因必填弹窗：所有审核驳回操作共用（PRD 3.2 驳回必填原因）。
 * 用法：<RejectReasonDialog v-model="visible" title="驳回" :loading="submitting" @confirm="onReject" />
 * 确认时若原因去重空则拦截；父组件在 @confirm 里调驳回接口，成功后自行关闭弹窗。
 */
import { ref, watch } from "vue";
import { ElMessage } from "element-plus";

const props = defineProps<{
  modelValue: boolean;
  title?: string;
  loading?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "confirm", reason: string): void;
}>();

const reason = ref("");

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) reason.value = "";
  }
);

function handleConfirm() {
  const trimmed = reason.value.trim();
  if (!trimmed) {
    ElMessage.warning("请填写原因");
    return;
  }
  emit("confirm", trimmed);
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="title || '填写原因'"
    width="480px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-input
      v-model="reason"
      type="textarea"
      :rows="4"
      maxlength="200"
      show-word-limit
      :placeholder="placeholder || '请填写原因（必填），将推送并展示给员工'"
    />
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="danger" :loading="loading" @click="handleConfirm">确认提交</el-button>
    </template>
  </el-dialog>
</template>
