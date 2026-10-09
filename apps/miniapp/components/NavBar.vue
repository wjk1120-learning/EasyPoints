<script setup>
import { getCurrentInstance } from 'vue'

defineProps({
  title: { type: String, default: '' },
  back: { type: Boolean, default: true }
});

const emit = defineEmits(['back']);
const instance = getCurrentInstance();

function goBack() {
  if (instance?.vnode?.props?.onBack) {
    emit('back');
    return;
  }
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
    return;
  }
  uni.switchTab({ url: '/pages/home/index' });
}
</script>

<template>
  <view class="nav">
    <view class="nav-bar">
      <view v-if="back" class="nav-back" @tap="goBack">
        <view class="nav-chevron" />
      </view>
      <text class="nav-title">{{ title }}</text>
    </view>
  </view>
</template>

<style scoped>
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 90;
  background: #ffffff;
  padding-top: var(--status-bar-height);
  box-shadow: 0 1rpx 0 rgba(23, 26, 31, 0.05);
}

.nav-bar {
  height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
}

.nav-back {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -12rpx;
  margin-right: 8rpx;
}

.nav-chevron {
  width: 20rpx;
  height: 20rpx;
  border-left: 4rpx solid #1a2233;
  border-bottom: 4rpx solid #1a2233;
  transform: rotate(45deg);
  border-radius: 2rpx;
}

.nav-back:active {
  opacity: 0.6;
}

.nav-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 32rpx;
  font-weight: 700;
  color: #1a2233;
  text-align: left;
}
</style>
