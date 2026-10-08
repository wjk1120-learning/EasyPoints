<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { isMissingApi, request } from '../../api'

const tab = ref('pending')
const rows = ref([])
const missing = ref('')
const loading = ref(false)

onShow(load)

async function load() {
  loading.value = true
  missing.value = ''
  try {
    const data = await request(`/miniapp/votes?scope=${tab.value}`)
    rows.value = Array.isArray(data) ? data : []
  } catch (error) {
    rows.value = []
    missing.value = isMissingApi(error)
      ? '后端尚未提供 GET /miniapp/votes。投票由管理员创建并指定参与人，员工端不能本地造票。'
      : (error?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function switchTab(next) {
  if (tab.value === next) return
  tab.value = next
  load()
}

function openVote(item) {
  uni.navigateTo({ url: `/pages/vote/index?id=${encodeURIComponent(item.id)}` })
}
</script>

<template>
  <view class="page">
    <view class="tabs">
      <text :class="{ active: tab === 'pending' }" @tap="switchTab('pending')">待参与投票</text>
      <text :class="{ active: tab === 'history' }" @tap="switchTab('history')">历史投票</text>
    </view>
    <view v-if="missing" class="card"><text class="muted">{{ missing }}</text></view>
    <view v-else-if="loading" class="card card-empty"><text class="muted">加载中...</text></view>
    <view v-for="item in rows" :key="item.id" class="card" @tap="openVote(item)">
      <text class="title">{{ item.title }}</text>
      <text class="muted">{{ item.description || '管理员下发的投票' }}</text>
      <text class="muted">{{ item.deadline ? `截止 ${item.deadline}` : (item.submitted ? '已提交' : '') }}</text>
    </view>
    <view v-if="!loading && !missing && rows.length === 0" class="card card-empty">
      <text class="muted">{{ tab === 'pending' ? '暂无待参与投票' : '暂无历史投票' }}</text>
    </view>
  </view>
</template>

<style scoped>
.tabs { display: flex; gap: 28rpx; margin-bottom: 16rpx; color: #9ca3af; }
.tabs .active { color: #111827; font-weight: 700; }
.title { display: block; font-weight: 700; margin-bottom: 8rpx; }
</style>
