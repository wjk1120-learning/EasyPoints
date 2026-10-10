<script setup>
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { request } from '../../api'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AiFloatBall from '../../components/AiFloatBall.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

const messages = ref([])
const loading = ref(false)
const typeFilter = ref('all')

const FILTERS = ['all', '积分变动', '兑换审核', '任务审核', '积分申请', '申诉结果', '投票', '其他']

const unreadCount = computed(() => messages.value.filter((item) => !item.isRead).length)

const visibleMessages = computed(() => {
  if (typeFilter.value === 'all') return messages.value
  return messages.value.filter((item) => typeMeta(item).label === typeFilter.value)
})

function typeMeta(item) {
  const text = `${item?.type || ''} ${item?.title || ''} ${item?.summary || ''}`
  if (item?.type === 'vote_assigned' || item?.type === 'vote' || /投票/.test(text)) {
    return { label: '投票', icon: 'check-square', tile: 'purple' }
  }
  if (item?.type === 'order_status' || /兑换|订单/.test(text)) {
    return { label: '兑换审核', icon: 'shopping-bag', tile: 'blue' }
  }
  if (item?.type === 'task' || /任务/.test(text)) {
    return { label: '任务审核', icon: 'clipboard', tile: 'amber' }
  }
  if (/申诉/.test(text)) {
    return { label: '申诉结果', icon: 'shield', tile: 'green' }
  }
  if (/申请/.test(text)) {
    return { label: '积分申请', icon: 'file-text', tile: 'purple' }
  }
  if (/积分/.test(text)) {
    return { label: '积分变动', icon: 'activity', tile: 'green' }
  }
  return { label: '其他', icon: 'bell', tile: 'blue' }
}

onShow(load)
onReachBottom(load)

async function load() {
  loading.value = true
  try {
    messages.value = await request('/miniapp/messages')
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function isVote(item) {
  return typeMeta(item).label === '投票'
}

function voteIdOf(item) {
  const summary = String(item?.summary || '')
  try {
    const parsed = JSON.parse(summary)
    if (parsed?.voteId) return String(parsed.voteId)
  } catch {}
  const match = summary.match(/voteId[=:：\s]+(\w+)/i)
  return match ? match[1] : ''
}

async function openMessage(item) {
  if (!item?.isRead) {
    try {
      await request(`/miniapp/messages/${item.id}/read`, { method: 'POST' })
      item.isRead = true
    } catch {}
  }
  if (isVote(item)) {
    const voteId = voteIdOf(item)
    uni.navigateTo({ url: voteId ? `/pages/vote/index?id=${encodeURIComponent(voteId)}` : '/pages/votes/index' })
    return
  }
  const query = [
    `id=${item.id}`,
    `title=${encodeURIComponent(item.title || '')}`,
    `summary=${encodeURIComponent(item.summary || '')}`,
    `type=${encodeURIComponent(item.type || '')}`,
    `createdAt=${encodeURIComponent(item.createdAt || '')}`
  ].join('&')
  uni.navigateTo({ url: `/pages/message/index?${query}` })
}

async function markAllRead() {
  try {
    await request('/miniapp/messages/read-all', { method: 'POST' })
    await load()
    uni.showToast({ title: '已全部标记为已读', icon: 'none' })
  } catch (error) {
    uni.showToast({ title: error?.message || '操作失败', icon: 'none' })
  }
}

function pickType() {
  uni.showActionSheet({
    itemList: FILTERS.map((label) => (label === 'all' ? '全部类型' : label)),
    success(res) {
      typeFilter.value = FILTERS[res.tapIndex]
    }
  })
}

function friendlyTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  if (diffDays === 0) return `今天 ${hh}:${mm}`
  if (diffDays === 1) return `昨天 ${hh}:${mm}`
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${m}月${d}日`
}

function displayTitle(item) {
  if (isVote(item) && (!item.title || item.title === '系统通知')) return '有新的投票待你参与'
  return item.title
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="通知中心" />

    <view class="list-head">
      <text class="list-head-text">{{ unreadCount > 0 ? `${unreadCount} 条未读消息` : '消息已全部已读' }}</text>
      <view class="list-head-actions">
        <text v-if="unreadCount > 0" class="list-head-read" @tap="markAllRead">全部已读</text>
        <view class="list-head-filter" @tap="pickType">
          <AppIcon name="list" :size="26" color="brand" />
          <text>{{ typeFilter === 'all' ? '全部类型' : typeFilter }}</text>
        </view>
      </view>
    </view>

    <!-- 加载骨架：行式（圆点 + 两行文字），布局与消息行一致 -->
    <template v-if="loading">
      <view v-for="n in 4" :key="`sk-${n}`" class="msg">
        <view class="sk sk-icon" />
        <view class="sk-lines">
          <view class="sk sk-line w64" />
          <view class="sk sk-line w40" />
        </view>
      </view>
    </template>

    <view
      v-for="item in visibleMessages"
      :key="item.id"
      class="msg press"
      :class="{ 'msg-read': item.isRead }"
      @tap="openMessage(item)"
    >
      <view class="icon-tile msg-icon" :class="typeMeta(item).tile">
        <AppIcon :name="typeMeta(item).icon" :size="36" :color="typeMeta(item).tile === 'blue' ? 'brand' : typeMeta(item).tile" />
        <view v-if="!item.isRead" class="msg-dot" />
      </view>
      <view class="msg-main">
        <view class="row between">
          <text class="msg-title" :class="{ 'msg-title-read': item.isRead }">{{ displayTitle(item) }}</text>
          <text class="msg-time">{{ friendlyTime(item.createdAt) }}</text>
        </view>
        <text class="msg-summary" :class="{ 'msg-summary-read': item.isRead }">{{ item.summary }}</text>
        <text class="msg-tag" :class="`tag-${typeMeta(item).tile}`">{{ typeMeta(item).label }}</text>
      </view>
    </view>

    <view v-if="!loading && visibleMessages.length === 0" class="card card-empty">
      <EmptyState icon="bell" title="暂无通知" />
    </view>
    <view v-if="visibleMessages.length > 0" class="list-footer">消息按时间排序 · 上拉加载更多</view>

    <AiFloatBall />
    <AppTabBar />
  </view>
</template>

<style scoped>
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -8rpx 4rpx 20rpx;
}

.list-head-text {
  font-size: 24rpx;
  color: var(--muted);
}

.list-head-actions {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.list-head-read {
  font-size: 24rpx;
  color: var(--brand);
  font-weight: 500;
}

.list-head-read:active {
  opacity: 0.6;
}

.list-head-filter {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 24rpx;
  color: var(--ink-3);
}

.list-head-filter:active {
  opacity: 0.6;
}

.msg {
  display: flex;
  gap: 20rpx;
  padding: 26rpx 28rpx;
  margin-bottom: 16rpx;
  border-radius: 20rpx;
  background: var(--surface);
  box-shadow: 0 1rpx 2rpx rgba(23, 26, 31, 0.03), 0 8rpx 24rpx rgba(23, 26, 31, 0.04);
}

.msg:active {
  opacity: 0.9;
}

.msg-read {
  background: #fafbfc;
  box-shadow: none;
}

.msg-icon {
  position: relative;
  width: 80rpx;
  height: 80rpx;
  font-size: 36rpx;
}

.msg-dot {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  width: 16rpx;
  height: 16rpx;
  border-radius: 999rpx;
  background: var(--red);
  border: 3rpx solid var(--surface);
  box-sizing: content-box;
}

.msg-main {
  flex: 1;
  min-width: 0;
}

.msg-title {
  flex: 1;
  min-width: 0;
  margin-right: 16rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-title-read {
  font-weight: 500;
  color: var(--ink-3);
}

.msg-time {
  flex-shrink: 0;
  font-size: 22rpx;
  color: var(--faint);
}

.msg-summary {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-summary-read {
  color: var(--muted);
}

.msg-tag {
  display: inline-block;
  margin-top: 12rpx;
  font-size: 22rpx;
}

.tag-blue { color: var(--brand); }
.tag-green { color: var(--green); }
.tag-amber { color: var(--amber); }
.tag-purple { color: var(--purple); }
.tag-red { color: var(--red); }

.list-footer {
  text-align: center;
  padding: 16rpx 0 8rpx;
  font-size: 22rpx;
  color: var(--faint);
}

/* ── 加载骨架尺寸 ── */
.sk-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: var(--r-full);
}

.sk-line {
  height: 28rpx;
}

.sk-lines {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.w40 { width: 40%; }
.w64 { width: 64%; }
</style>
