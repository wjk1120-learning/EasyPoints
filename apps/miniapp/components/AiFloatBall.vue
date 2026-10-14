<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const AI_AVATAR = '/static/xiaoyi-avatar.png'

// AI 功能临时下线开关（2026-10-10 用户要求隐藏）：false 时悬浮球不渲染、不挂事件监听，
// 各页面挂载无需改动。恢复上线改回 true；彻底移除时再删本组件并清理页面挂载。
const AI_FEATURE_ENABLED = false

// 球体尺寸用固定 px（内联样式），贴边坐标计算才精确；rpx 会随屏宽缩放，宽屏下会把球推出屏幕外
const BALL = 48
const MARGIN = 12
const sys = uni.getSystemInfoSync()
const winW = sys.windowWidth || 375
const winH = sys.windowHeight || 667
// 纵向活动范围：避开顶部导航与底部 tabBar
const MIN_Y = 80
const MAX_Y = Math.max(MIN_Y + 60, winH - BALL - 130)

const AI_PAGE = '/pages/ai/index'

// ── H5：普通 fixed view，位置完全由自己的鼠标/触摸事件驱动 ──
// #ifdef H5
const pos = ref({ x: winW - BALL - MARGIN, y: MAX_Y })
const ballStyle = ref({
  left: `${pos.value.x}px`,
  top: `${pos.value.y}px`,
  width: `${BALL}px`,
  height: `${BALL}px`
})

let dragging = false
let moved = false
let startX = 0
let startY = 0

function setPos(nx, ny) {
  pos.value = {
    x: Math.min(Math.max(nx, MARGIN), winW - BALL - MARGIN),
    y: Math.min(Math.max(ny, MIN_Y), MAX_Y)
  }
  ballStyle.value = {
    left: `${pos.value.x}px`,
    top: `${pos.value.y}px`,
    width: `${BALL}px`,
    height: `${BALL}px`
  }
}

function startDrag(cx, cy) {
  dragging = true
  moved = false
  startX = cx
  startY = cy
}

function moveDrag(cx, cy) {
  if (!dragging) return
  if (Math.abs(cx - startX) > 4 || Math.abs(cy - startY) > 4) moved = true
  if (!moved) return
  setPos(cx - BALL / 2, cy - BALL / 2)
}

function endDrag() {
  if (!dragging) return
  dragging = false
  if (!moved) {
    openAi()
    return
  }
  // 贴边：纵向留在原地（已在范围内），横向吸附到近侧边缘
  const side = pos.value.x + BALL / 2 < winW / 2 ? MARGIN : winW - BALL - MARGIN
  setPos(side, pos.value.y)
}

function onTouchStart(e) {
  const touch = e.touches && e.touches[0]
  if (touch) startDrag(touch.clientX, touch.clientY)
}

function onTouchMove(e) {
  const touch = e.touches && e.touches[0]
  if (touch) moveDrag(touch.clientX, touch.clientY)
}

function onTouchEnd() {
  endDrag()
}

function onMouseDown(e) {
  startDrag(e.clientX, e.clientY)
}

function onMouseMove(e) {
  moveDrag(e.clientX, e.clientY)
}

function onMouseUp() {
  endDrag()
}

onMounted(() => {
  if (!AI_FEATURE_ENABLED) return
  // 鼠标拖动中光标会离开球体，move/up 必须挂 window 才不丢事件
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
// #endif

// ── mp：movable-view 原生触摸拖拽 ──
// #ifndef H5
const x = ref(winW - BALL - MARGIN)
const y = ref(MAX_Y)
const areaStyle = { width: `${winW}px`, height: `${winH}px` }
const ballStyle = { width: `${BALL}px`, height: `${BALL}px` }

let dragging = false
let moved = false
let startX = 0
let startY = 0
let curX = x.value
let curY = y.value

function onChange(e) {
  if (e.detail && typeof e.detail.x === 'number') {
    curX = e.detail.x
    curY = e.detail.y
  }
}

function onTouchStartMp(e) {
  dragging = true
  moved = false
  const touch = e.touches && e.touches[0] ? e.touches[0] : e
  startX = touch.clientX ?? 0
  startY = touch.clientY ?? 0
}

function onTouchEndMp() {
  if (!dragging) return
  dragging = false
  if (!moved) {
    openAi()
    return
  }
  const side = curX + BALL / 2 < winW / 2 ? MARGIN : winW - BALL - MARGIN
  x.value = side
  y.value = Math.min(Math.max(curY, MIN_Y), MAX_Y)
}

function onTouchMoveMp() {
  if (!dragging) return
  if (Math.abs(curX - (startX - BALL / 2)) > 4 || Math.abs(curY - (startY - BALL / 2)) > 4) moved = true
}
// #endif

function openAi() {
  uni.navigateTo({ url: AI_PAGE })
}
</script>

<template>
  <!-- #ifdef H5 -->
  <view
    v-if="AI_FEATURE_ENABLED"
    class="float-ball"
    :style="ballStyle"
    @touchstart="onTouchStart"
    @touchmove.stop.prevent="onTouchMove"
    @touchend="onTouchEnd"
    @mousedown="onMouseDown"
  >
    <image class="ball-img" :src="AI_AVATAR" mode="aspectFill" />
    <view class="ball-pulse" />
  </view>
  <!-- #endif -->

  <!-- #ifndef H5 -->
  <movable-area v-if="AI_FEATURE_ENABLED" class="float-area" :style="areaStyle">
    <movable-view
      class="float-ball float-ball-mp"
      :style="ballStyle"
      direction="all"
      :animation="true"
      :damping="40"
      :x="x"
      :y="y"
      @change="onChange"
      @touchstart="onTouchStartMp"
      @touchmove="onTouchMoveMp"
      @touchend="onTouchEndMp"
    >
      <image class="ball-img" :src="AI_AVATAR" mode="aspectFill" />
      <view class="ball-pulse" />
    </movable-view>
  </movable-area>
  <!-- #endif -->
</template>

<style scoped>
.float-ball {
  position: fixed;
  z-index: 998;
  border-radius: 50%;
  background: var(--surface);
  border: 3rpx solid var(--brand);
  box-shadow: 0 8rpx 24rpx rgba(47, 107, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  /* #ifdef H5 */
  cursor: grab;
  /* #endif */
}

.float-ball-mp {
  pointer-events: auto;
}

.float-area {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 998;
  pointer-events: none;
}

.ball-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.ball-pulse {
  position: absolute;
  top: -6rpx;
  left: -6rpx;
  right: -6rpx;
  bottom: -6rpx;
  border-radius: 50%;
  border: 3rpx solid rgba(47, 107, 255, 0.3);
  animation: ball-pulse 2.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes ball-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.55;
  }

  50% {
    transform: scale(1.16);
    opacity: 0;
  }
}
</style>
