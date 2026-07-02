<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { requestPaged } from '../../api'

const rows = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = 50
const total = ref(null)

onShow(async () => {
  await refresh()
  markSeen()
})

onPullDownRefresh(async () => {
  await refresh()
  uni.stopPullDownRefresh()
})

onReachBottom(async () => {
  await loadMore()
})

async function refresh() {
  page.value = 1
  total.value = null
  rows.value = []
  await loadMore()
}

function markSeen() {
  const latest = rows.value[0]
  if (latest && latest.occurredAt) {
    uni.setStorageSync('hallSeenAt', String(latest.occurredAt))
  } else if (!uni.getStorageSync('hallSeenAt')) {
    uni.setStorageSync('hallSeenAt', new Date().toISOString())
  }
  try {
    uni.removeTabBarBadge({ index: 1 })
  } catch {}
}

async function loadMore() {
  if (loading.value) return
  if (total.value != null && rows.value.length >= total.value) return
  loading.value = true
  try {
    const result = await requestPaged(`/miniapp/hall?page=${page.value}&pageSize=${pageSize}`)
    const data = Array.isArray(result.data) ? result.data : []
    rows.value = rows.value.concat(data)
    if (result.meta && Number.isFinite(Number(result.meta.total))) total.value = Number(result.meta.total)
    page.value += 1
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}
</script>

<template>
  <view class="page">
    <view class="card" v-for="item in rows" :key="item.id">
      <view class="head">
        <text class="name">{{ item.employeeName || `员工 ${item.employeeId}` }}</text>
        <text class="delta" :style="{ color: item.pointsDelta > 0 ? '#00a870' : '#e54b4f' }">
          {{ item.pointsDelta > 0 ? '+' : '' }}{{ item.pointsDelta }}
        </text>
      </view>
      <text class="summary">{{ item.remark }}</text>
      <text class="muted meta">
        {{ formatTime(item.occurredAt) }} · {{ item.operatorName || '系统' }}
      </text>
    </view>
    <view v-if="!loading && rows.length === 0" class="card">
      <text class="muted">暂无记录</text>
    </view>
    <view v-if="loading" class="card">
      <text class="muted">加载中...</text>
    </view>
    <view v-if="!loading && total != null && rows.length >= total && total > 0" class="card">
      <text class="muted">已加载全部</text>
    </view>
  </view>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.name {
  font-size: 30rpx;
  font-weight: 600;
}

.delta {
  font-size: 30rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.summary {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: #374151;
}

.meta {
  display: block;
  margin-top: 14rpx;
}
</style>
