<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { fetchRules } from '../../api/rule/rule'
import type { RuleSection } from '../../api/rule/types'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

const sections = ref<RuleSection[]>([])
const loading = ref(false)
const collapsed = ref<Record<number, boolean>>({})

const SECTION_ICONS = [
  { icon: 'landmark', tile: 'blue' },
  { icon: 'clipboard', tile: 'green' },
  { icon: 'shopping-bag', tile: 'amber' },
  { icon: 'shield', tile: 'purple' }
]

onShow(async () => {
  loading.value = true
  try {
    // 契约 8.7：仅 published，content 为管理端富文本 HTML，rich-text 渲染
    sections.value = await fetchRules()
    collapsed.value = {}
  } catch (error) {
    sections.value = []
    uni.showToast({ title: (error as Error)?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})

function toggle(index: number) {
  collapsed.value = { ...collapsed.value, [index]: !collapsed.value[index] }
}

function iconOf(index: number) {
  return SECTION_ICONS[index % SECTION_ICONS.length]
}

function metaOf(section: RuleSection) {
  const date = String(section.updatedAt || '').slice(0, 10)
  return [section.version ? `V${section.version}` : '', date ? `${date} 更新` : ''].filter(Boolean).join(' · ')
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="规则中心" />

    <view class="card card-info sync-banner">
      <view class="row sync-head">
        <view class="sync-icon"><AppIcon name="refresh" :size="26" color="brand" /></view>
        <text class="sync-title">规则与企业后台实时同步</text>
      </view>
      <text class="sync-body">如有更新将通过通知中心提醒。</text>
    </view>

    <view v-for="(section, index) in sections" :key="section.id ?? index" class="card rule-card">
      <view class="row between press" @tap="toggle(index)">
        <view class="row rule-head">
          <view class="icon-tile rule-icon" :class="iconOf(index).tile">
            <AppIcon :name="iconOf(index).icon" :size="36" :color="iconOf(index).tile === 'blue' ? 'brand' : iconOf(index).tile" />
          </view>
          <view class="rule-title-wrap">
            <text class="rule-title">{{ section.title }}</text>
            <text v-if="metaOf(section)" class="rule-meta">{{ metaOf(section) }}</text>
          </view>
        </view>
        <text class="rule-chevron" :class="{ 'rule-chevron-up': collapsed[index] }">⌄</text>
      </view>
      <view v-if="!collapsed[index]" class="rule-body">
        <rich-text class="rule-rich" :nodes="section.content || ''" />
      </view>
    </view>

    <view v-if="!loading && sections.length === 0" class="card card-empty"><EmptyState icon="book-open" title="暂无规则" /></view>
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
  display: inline-flex;
  align-items: center;
}

.sync-title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--brand);
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

.rule-title-wrap {
  flex: 1;
  min-width: 0;
}

.rule-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--ink);
}

.rule-meta {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--faint);
}

.rule-chevron {
  color: var(--faint);
  font-size: 28rpx;
  transition: transform 0.2s;
}

.rule-chevron-up {
  transform: rotate(180deg);
}

.rule-body {
  margin-top: 20rpx;
  font-size: 26rpx;
  color: #344156;
  line-height: 1.7;
}

.list-footer {
  text-align: center;
  padding: 8rpx 0;
  font-size: 22rpx;
  color: var(--faint);
}
</style>
