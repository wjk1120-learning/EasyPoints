<script setup>
import { computed, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { homeBadges } from '../utils/badge-state'

// 图标用统一线性图标组件（与全端同一套），选中 brand / 未选中 muted；
// pages.json 里的原生 tabBar 仅作占位（运行时被 hideTabBar 隐藏），不受此处影响。
const TABS = [
  { path: 'pages/home/index', text: '首页', icon: 'home' },
  { path: 'pages/mall/index', text: '积分商城', icon: 'shopping-bag' },
  { path: 'pages/tasks/index', text: '任务大厅', icon: 'target' },
  { path: 'pages/points/index', text: '积分明细', icon: 'list' },
  { path: 'pages/mine/index', text: '我的', icon: 'user' }
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

// 「首页」标签红点：首页快捷入口任一角标（未读消息/待参与投票/审核中订单）>0 时点亮
const homeDot = computed(() => homeBadges.messages > 0 || homeBadges.votes > 0 || homeBadges.orders > 0)
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
        <AppIcon :name="tab.icon" :size="44" :color="tab.path === activePath ? 'brand' : 'muted'" />
        <view v-if="tab.path === 'pages/home/index' && homeDot" class="tab-dot" />
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
  position: relative;
  width: 88rpx;
  height: 56rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

/* 首页标签红点（尺寸对齐全局 .unread-dot） */
.tab-dot {
  position: absolute;
  top: 0;
  right: 16rpx;
  width: 14rpx;
  height: 14rpx;
  border-radius: 999rpx;
  background: var(--red);
}

.tab-item-active .tab-icon-wrap {
  background: #eef4ff;
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
