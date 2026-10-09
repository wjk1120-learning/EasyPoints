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
      <view class="tab-icon-wrap">
        <image class="tab-icon" :src="tab.path === activePath ? tab.activeIcon : tab.icon" mode="aspectFit" />
      </view>
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
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1rpx solid rgba(23, 26, 31, 0.05);
  padding: 8rpx 0 calc(8rpx + env(safe-area-inset-bottom));
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
}

.tab-item:active {
  opacity: 0.7;
}

.tab-icon-wrap {
  width: 88rpx;
  height: 56rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.tab-item-active .tab-icon-wrap {
  background: #eef4ff;
}

.tab-icon {
  width: 44rpx;
  height: 44rpx;
}

.tab-text {
  font-size: 20rpx;
  color: #a6adb8;
  transition: color 0.2s;
}

.tab-item-active .tab-text {
  color: #2f6bff;
  font-weight: 600;
}
</style>
