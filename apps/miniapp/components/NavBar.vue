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
      <text v-if="title" class="nav-title">{{ title }}</text>
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
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  padding-top: var(--status-bar-height);
}

.nav-bar {
  position: relative;
  height: 114rpx;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
}

.nav-title {
  position: absolute;
  left: 50%;
  /* 水平居中后整体下移 1/2 字高（34rpx 字号 → 两次各 8.5rpx），用户 2026-10-09 分两次要求 */
  transform: translate(-50%, 17rpx);
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 34rpx;
  font-weight: 600;
  color: #1a2233;
  letter-spacing: 0.5rpx;
  text-align: center;
}

.nav-back {
  width: 56rpx;
  height: 56rpx;
  margin-left: -8rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.nav-back:active {
  background: rgba(23, 26, 31, 0.06);
}

.nav-chevron {
  width: 18rpx;
  height: 18rpx;
  margin-left: 6rpx;
  border-left: 3rpx solid #1a2233;
  border-bottom: 3rpx solid #1a2233;
  border-radius: 2rpx;
  transform: rotate(45deg);
}
</style>
