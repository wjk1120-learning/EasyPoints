<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '../../api'

const messages = ref([])
const filter = ref('unread')
const loading = ref(false)

onShow(async () => {
  await loadMessages()
})

async function loadMessages() {
  loading.value = true
  try {
    const query = filter.value === 'unread' ? '?unreadOnly=1' : ''
    messages.value = await request(`/miniapp/messages${query}`)
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

function statusClass(status) {
  if (status === 'mock_sent') return 'sent'
  if (status === 'failed') return 'failed'
  if (status === 'processing') return 'processing'
  return 'pending'
}

function unreadCount() {
  if (filter.value === 'unread') return messages.value.length
  return messages.value.filter((item) => !item.isRead).length
}

async function switchFilter(value) {
  if (filter.value === value) return
  filter.value = value
  await loadMessages()
}

async function markAllRead() {
  const count = unreadCount()
  if (!count) return
  const confirmed = await new Promise((resolve) => {
    uni.showModal({
      title: '全部标记已读',
      content: `确认将 ${count} 条通知标记为已读？`,
      success(res) {
        resolve(Boolean(res.confirm))
      },
      fail() {
        resolve(false)
      }
    })
  })
  if (!confirmed) return
  try {
    await request('/miniapp/messages/read-all', { method: 'POST' })
    await loadMessages()
    uni.showToast({ title: '已全部标记为已读', icon: 'none' })
  } catch (error) {
    uni.showToast({ title: error?.message || '操作失败', icon: 'none' })
  }
}

async function openMessage(item) {
  if (!item || item.isRead) return
  try {
    const updated = await request(`/miniapp/messages/${item.id}/read`, { method: 'POST' })
    if (filter.value === 'unread') {
      messages.value = messages.value.filter((m) => m.id !== item.id)
      return
    }
    messages.value = messages.value.map((m) => (m.id === item.id ? updated : m))
  } catch (error) {
    uni.showToast({ title: error?.message || '操作失败', icon: 'none' })
  }
}
</script>

<template>
  <view class="page">
    <view class="card toolbar">
      <view class="tabs">
        <view class="tab" :class="{ active: filter === 'unread' }" @tap="switchFilter('unread')">未读</view>
        <view class="tab" :class="{ active: filter === 'all' }" @tap="switchFilter('all')">全部</view>
      </view>
      <view class="action" :class="{ disabled: unreadCount() === 0 }" @tap="markAllRead">
        全部已读
      </view>
    </view>

    <view v-for="item in messages" :key="item.id" class="card tapCard" @tap="openMessage(item)">
      <view class="head">
        <view class="titleWrap">
          <text v-if="!item.isRead" class="dot"></text>
          <text class="title" :class="{ read: item.isRead }">{{ item.title }}</text>
        </view>
        <text class="badge" :class="statusClass(item.status)">{{ item.statusText }}</text>
      </view>
      <text class="summary">{{ item.summary }}</text>
      <text class="muted time">
        {{ formatTime(item.createdAt) }}{{ item.readAt ? ` · 已读 ${formatTime(item.readAt)}` : '' }}
      </text>
    </view>
    <view v-if="!loading && messages.length === 0" class="card">
      <text class="muted">{{ filter === 'unread' ? '暂无未读通知' : '暂无通知' }}</text>
    </view>
  </view>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.tabs {
  display: flex;
  gap: 12rpx;
  background: #f3f4f6;
  padding: 8rpx;
  border-radius: 999rpx;
}

.tab {
  min-width: 120rpx;
  height: 60rpx;
  line-height: 60rpx;
  text-align: center;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.active {
  background: #fff;
  color: #111827;
  box-shadow: 0 8rpx 22rpx rgba(31, 41, 55, 0.06);
}

.action {
  height: 60rpx;
  line-height: 60rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #1d4ed8;
  font-size: 24rpx;
}

.disabled {
  opacity: 0.45;
}

.tapCard:active {
  opacity: 0.9;
  transform: scale(0.99);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.titleWrap {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.title {
  font-size: 30rpx;
  font-weight: 600;
}

.read {
  color: #6b7280;
}

.dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 999rpx;
  background: #1677ff;
  flex-shrink: 0;
}

.summary {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: #374151;
}

.time {
  display: block;
  margin-top: 16rpx;
}

.badge {
  flex-shrink: 0;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.pending {
  background: #eff6ff;
  color: #2563eb;
}

.processing {
  background: #f5f3ff;
  color: #7c3aed;
}

.sent {
  background: #ecfdf5;
  color: #059669;
}

.failed {
  background: #fef2f2;
  color: #dc2626;
}
</style>
