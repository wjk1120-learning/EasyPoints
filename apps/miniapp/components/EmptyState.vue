<script setup>
import AppIcon from './AppIcon.vue'

defineProps({
  icon: { type: String, default: 'inbox' },
  title: { type: String, default: '暂无数据' },
  hint: { type: String, default: '' },
  // 传入则在底部渲染操作按钮，点击时触发 action 事件
  actionText: { type: String, default: '' }
})

defineEmits(['action'])
</script>

<template>
  <view class="empty-state">
    <view class="empty-icon">
      <AppIcon :name="icon" :size="56" color="muted" />
    </view>
    <text class="empty-title">{{ title }}</text>
    <text v-if="hint" class="empty-hint">{{ hint }}</text>
    <view v-if="actionText" class="empty-action" @tap="$emit('action')">{{ actionText }}</view>
  </view>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 32rpx;
  text-align: center;
}

.empty-icon {
  width: 112rpx;
  height: 112rpx;
  border-radius: var(--r-full);
  background: var(--fill);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.empty-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink-2);
}

.empty-hint {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--muted);
}

.empty-action {
  margin-top: 24rpx;
  padding: 0 40rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: var(--r-full);
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 26rpx;
  font-weight: 600;
}

.empty-action:active {
  opacity: 0.85;
}
</style>
