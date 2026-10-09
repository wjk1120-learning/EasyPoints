<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { isMissingApi, request } from '../../api'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'

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

function deadlineOf(item) {
  if (!item.deadline) return ''
  const date = new Date(item.deadline)
  if (Number.isNaN(date.getTime())) return String(item.deadline)
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  return `${m}-${d} ${hh}:${mm}`
}

function multipleOf(item) {
  return item.mode === 'multiple' || item.multiple === true
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="我的投票" />

    <view class="segmented">
      <text class="tab" :class="{ active: tab === 'pending' }" @tap="switchTab('pending')">待参与投票</text>
      <text class="tab" :class="{ active: tab === 'history' }" @tap="switchTab('history')">历史投票</text>
    </view>

    <view v-if="missing" class="card"><text class="muted">{{ missing }}</text></view>

    <template v-else>
      <view v-if="loading" class="card card-empty"><text class="muted">加载中...</text></view>
      <view v-for="item in rows" :key="item.id" class="card vote-card" @tap="openVote(item)">
        <view class="row between">
          <text class="vote-title">{{ item.title }}</text>
          <text v-if="item.submitted" class="pill green">已提交</text>
          <text v-else-if="tab === 'pending'" class="pill blue">待参与</text>
          <text v-else class="pill">已结束</text>
        </view>
        <text v-if="item.description" class="vote-desc">{{ item.description }}</text>
        <view class="row between vote-meta">
          <text class="muted">{{ multipleOf(item) ? '多选' : '单选' }}</text>
          <text v-if="deadlineOf(item)" class="vote-deadline" :class="{ neg: tab === 'pending' }">截至 {{ deadlineOf(item) }}</text>
        </view>
      </view>
      <view v-if="!loading && rows.length === 0" class="card card-empty">
        <text class="muted">{{ tab === 'pending' ? '暂无待参与投票' : '暂无历史投票' }}</text>
      </view>
    </template>

    <AppTabBar />
  </view>
</template>

<style scoped>
.vote-card {
  padding: 26rpx 28rpx;
}

.vote-card:active {
  opacity: 0.9;
}

.vote-title {
  flex: 1;
  min-width: 0;
  margin-right: 16rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #1a2233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vote-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vote-meta {
  margin-top: 14rpx;
}

.vote-deadline {
  font-size: 22rpx;
  color: #9aa1ab;
}
</style>
