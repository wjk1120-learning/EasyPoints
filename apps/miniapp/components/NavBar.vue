<script setup>
defineProps({
  title: { type: String, default: '' },
  right: { type: String, default: '' },
  rightDot: { type: Boolean, default: false },
  back: { type: Boolean, default: true }
});

const emit = defineEmits(['right']);

function goBack() {
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
      <view class="nav-side">
        <view v-if="back" class="nav-back" @tap="goBack">
          <view class="nav-chevron" />
        </view>
      </view>
      <text class="nav-title">{{ title }}</text>
      <view class="nav-side nav-side-right">
        <view v-if="right" class="nav-right" @tap="emit('right')">
          <text class="nav-right-text">{{ right }}</text>
          <view v-if="rightDot" class="nav-right-dot" />
        </view>
      </view>
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
  position: relative;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
}

.nav-side {
  width: 120rpx;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.nav-side-right {
  justify-content: flex-end;
}

.nav-back {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -12rpx;
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
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 32rpx;
  font-weight: 700;
  color: #1a2233;
  text-align: center;
}

.nav-right {
  position: relative;
  display: flex;
  align-items: center;
  height: 56rpx;
  padding: 0 4rpx;
}

.nav-right:active {
  opacity: 0.6;
}

.nav-right-text {
  color: #2f6bff;
  font-size: 26rpx;
  font-weight: 500;
}

.nav-right-dot {
  position: absolute;
  top: 4rpx;
  right: -14rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: #f04438;
}
</style>
