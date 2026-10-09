<script setup>
import { ref } from 'vue'

const TABS = [
  { path: 'pages/home/index', text: '首页', icon: '/static/tabbar/home.png', activeIcon: '/static/tabbar/home-active.png' },
  { path: 'pages/mall/index', text: '商城', icon: '/static/tabbar/mall.png', activeIcon: '/static/tabbar/mall-active.png' },
  { path: 'pages/tasks/index', text: '任务', icon: '/static/tabbar/tasks.png', activeIcon: '/static/tabbar/tasks-active.png' },
  { path: 'pages/points/index', text: '明细', icon: '/static/tabbar/points.png', activeIcon: '/static/tabbar/points-active.png' },
  { path: 'pages/mine/index', text: '我的', icon: '/static/tabbar/mine.png', activeIcon: '/static/tabbar/mine-active.png' }
]

const activePath = ref('')

const pages = getCurrentPages()
const current = pages[pages.length - 1]
activePath.value = current ? current.route : ''
// 底栏在每个页面常驻显示；Tab 页隐藏原生 tabBar，避免出现双底栏
uni.hideTabBar({ animation: false, fail: () => {} })

function onTap(tab) {
  if (tab.path === activePath.value) return
  uni.switchTab({ url: `/${tab.path}` })
}
</script>

<template>
  <view class="tab-bar">
    <view
      v-for="tab in TABS"
      :key="tab.path"
      class="tab-item"
      :class="{ 'tab-item-active': tab.path === activePath }"
      @tap="onTap(tab)"
    >
      <image class="tab-icon" :src="tab.path === activePath ? tab.activeIcon : tab.icon" mode="aspectFit" />
      <text class="tab-text">{{ tab.text }}</text>
    </view>
  </view>
</template>

<style scoped>
.tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: stretch;
  background: #ffffff;
  border-top: 1rpx solid #eef0f3;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  padding: 12rpx 0 10rpx;
}

.tab-item:active {
  opacity: 0.75;
}

.tab-icon {
  width: 48rpx;
  height: 48rpx;
}

.tab-text {
  font-size: 20rpx;
  color: #9ca3af;
}

.tab-item-active .tab-text {
  color: #2f6bff;
  font-weight: 600;
}
</style>
