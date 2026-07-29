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
      <view class="action-link" :class="{ disabled: unreadCount() === 0 }" @tap="markAllRead">
        全部已读
      </view>
    </view>

    <view v-for="item in messages" :key="item.id" class="card tap-card msg-card" @tap="openMessage(item)">
      <view class="row between msg-head">
        <view class="row title-wrap">
          <text v-if="!item.isRead" class="unread-dot"></text>
          <text class="msg-title" :class="{ read: item.isRead }">{{ item.title }}</text>
        </view>
        <text class="badge" :class="statusClass(item.status)">{{ item.statusText }}</text>
      </view>
      <text class="msg-summary">{{ item.summary }}</text>
      <text class="muted msg-time">
        {{ formatTime(item.createdAt) }}{{ item.readAt ? ` · 已读 ${formatTime(item.readAt)}` : '' }}
      </text>
    </view>

    <view v-if="!loading && messages.length === 0" class="card card-empty">
      <text class="muted">{{ filter === 'unread' ? '暂无未读通知' : '暂无通知' }}</text>
    </view>
  </view>
</template>

<style scoped>
.title-wrap {
  gap: 12rpx;
  min-width: 0;
  flex: 1;
}

.msg-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1c1c1e;
}

.msg-title.read {
  color: #8e8e93;
  font-weight: 500;
}

.msg-summary {
  display: block;
  margin-top: 14rpx;
  font-size: 28rpx;
  line-height: 1.65;
  color: #3a3a3c;
}

.msg-time {
  display: block;
  margin-top: 14rpx;
}
</style>
