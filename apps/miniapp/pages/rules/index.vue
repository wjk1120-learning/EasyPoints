<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { isMissingApi, request } from '../../api'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'

const sections = ref([])
const missing = ref('')
const collapsed = ref({})

const SECTION_ICONS = [
  { emoji: '🏛️', tile: 'blue' },
  { emoji: '📋', tile: 'green' },
  { emoji: '🛍️', tile: 'amber' },
  { emoji: '🛡️', tile: 'purple' }
]

onShow(async () => {
  try {
    const data = await request('/miniapp/rules')
    sections.value = Array.isArray(data) ? data : (data?.sections || [])
    missing.value = ''
  } catch (error) {
    sections.value = []
    missing.value = isMissingApi(error)
      ? '规则由后台配置。约定 GET /miniapp/rules 返回 [{ title, content }]。接口未提供前，这里不写死一份规则，避免和后台各写各的。'
      : (error?.message || '加载失败')
  }
})

function toggle(index) {
  collapsed.value = { ...collapsed.value, [index]: !collapsed.value[index] }
}

function bulletsOf(content) {
  return String(content || '')
    .split(/\n|；|;/)
    .map((line) => line.trim().replace(/^[-•·]\s*/, ''))
    .filter(Boolean)
}

function iconOf(index) {
  return SECTION_ICONS[index % SECTION_ICONS.length]
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="规则中心" />

    <view class="card card-info sync-banner">
      <view class="row sync-head">
        <text class="sync-icon">🔄</text>
        <text class="sync-title">规则与企业后台实时同步</text>
      </view>
      <text class="sync-body">如有更新将通过通知中心提醒。</text>
    </view>

    <view v-if="missing" class="card"><text class="muted">{{ missing }}</text></view>

    <view v-for="(section, index) in sections" :key="index" class="card rule-card">
      <view class="row between" @tap="toggle(index)">
        <view class="row rule-head">
          <view class="icon-tile rule-icon" :class="iconOf(index).tile">{{ iconOf(index).emoji }}</view>
          <text class="rule-title">{{ section.title }}</text>
        </view>
        <text class="rule-chevron" :class="{ 'rule-chevron-up': collapsed[index] }">⌄</text>
      </view>
      <view v-if="!collapsed[index]" class="rule-body">
        <view v-for="(line, lineIndex) in bulletsOf(section.content)" :key="lineIndex" class="rule-line">
          <view class="rule-dot" />
          <text class="rule-text">{{ line }}</text>
        </view>
        <text v-if="bulletsOf(section.content).length === 0" class="muted">{{ section.content }}</text>
      </view>
    </view>

    <view v-if="!missing && sections.length === 0" class="card card-empty"><text class="muted">暂无规则内容</text></view>
    <view v-if="sections.length > 0" class="list-footer">如对规则有疑问，请联系系统积分管理员</view>

    <AppTabBar />
  </view>
</template>

<style scoped>
.sync-banner {
  padding: 24rpx 28rpx;
}

.sync-head {
  gap: 10rpx;
}

.sync-icon {
  font-size: 26rpx;
}

.sync-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #2f6bff;
}

.sync-body {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #6b7fa8;
}

.rule-card {
  padding: 24rpx 28rpx;
}

.rule-head {
  gap: 20rpx;
  flex: 1;
  min-width: 0;
}

.rule-icon {
  width: 68rpx;
  height: 68rpx;
  font-size: 30rpx;
}

.rule-title {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 700;
  color: #1a2233;
}

.rule-chevron {
  color: #b4bac3;
  font-size: 28rpx;
  transition: transform 0.2s;
}

.rule-chevron-up {
  transform: rotate(180deg);
}

.rule-body {
  margin-top: 20rpx;
}

.rule-line {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 8rpx 0;
}

.rule-dot {
  flex-shrink: 0;
  width: 10rpx;
  height: 10rpx;
  border-radius: 999rpx;
  background: #2f6bff;
  margin-top: 16rpx;
}

.rule-text {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  color: #344156;
  line-height: 1.7;
}

.list-footer {
  text-align: center;
  padding: 8rpx 0;
  font-size: 22rpx;
  color: #b4bac3;
}
</style>
