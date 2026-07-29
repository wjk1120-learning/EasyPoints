<script setup>
import { ref } from 'vue'

const AI_AVATAR = '/static/ai-avatar.png'

const ballStyle = ref({
  right: '32rpx',
  bottom: '140rpx'
})

/* 可拖拽偏移量 */
let startX = 0
let startY = 0
let startRight = 32
let startBottom = 140

function onTouchStart(e) {
  const touch = e.touches[0]
  startX = touch.clientX
  startY = touch.clientY
  const match = (ballStyle.value.right || '').match(/[\d.]+/)
  startRight = match ? parseFloat(match[0]) : 32
  const matchB = (ballStyle.value.bottom || '').match(/[\d.]+/)
  startBottom = matchB ? parseFloat(matchB[0]) : 140
}

function onTouchMove(e) {
  const touch = e.touches[0]
  const dx = startX - touch.clientX
  const dy = startY - touch.clientY
  ballStyle.value = {
    right: `${startRight + dx}px`,
    bottom: `${startBottom + dy}px`
  }
}

function openAi() {
  uni.navigateTo({ url: '/pages/ai/index' })
}
</script>

<template>
  <view
    class="ai-float-ball"
    :style="ballStyle"
    @tap="openAi"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
  >
    <image class="ball-img" :src="AI_AVATAR" mode="aspectFill" />
    <view class="ball-pulse" />
  </view>
</template>

<style scoped>
.ai-float-ball {
  position: fixed;
  z-index: 999;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.72);
  border: 2rpx solid rgba(168, 216, 234, 0.5);
  box-shadow: 0 8rpx 28rpx rgba(91, 155, 213, 0.18), 0 1rpx 0 rgba(255, 255, 255, 0.9) inset;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.ball-img {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  z-index: 1;
}

.ball-pulse {
  position: absolute;
  top: -6rpx;
  left: -6rpx;
  right: -6rpx;
  bottom: -6rpx;
  border-radius: 50%;
  border: 3rpx solid rgba(91, 155, 213, 0.25);
  animation: pulse 2.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.55;
  }
  50% {
    transform: scale(1.18);
    opacity: 0;
  }
}
</style>
