<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { fetchOrders } from '../../api/order/order'
import type { Order } from '../../api/order/types'
import { formatPoints, formatTime } from '../../utils/format'
import { homeBadges } from '../../utils/badge-state'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

type FilterKey = 'all' | 'pending' | 'passed' | 'rejected'
type StatusKey = Exclude<FilterKey, 'all'>

const orders = ref<Order[]>([])
const filter = ref<FilterKey>('all')

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '审核中' },
  { key: 'passed', label: '已通过' },
  { key: 'rejected', label: '已驳回' }
]

function matchStatus(item: Order, key: StatusKey): boolean {
  if (key === 'pending') return item.status === 'pending_review'
  if (key === 'passed') return ['approved', 'shipped', 'completed'].includes(item.status || '')
  return ['rejected', 'cancelled'].includes(item.status || '')
}

const statusIds = (key: StatusKey) => orders.value.filter((item) => matchStatus(item, key)).map((item) => String(item.id))

const visibleOrders = computed(() => {
  if (filter.value === 'all') return orders.value
  return orders.value.filter((item) => matchStatus(item, filter.value as StatusKey))
})

// ── 未读徽标：仅「已通过/已驳回」是新变化提醒（点击即提醒完成、清零不常驻）；
// 「审核中」是流程状态不显示徽标（数量由首页入口角标承担）。已读记录本地持久化 ──
const SEEN_KEY = 'orders:seenIds'
type SeenMap = Record<StatusKey, string[]>

function loadSeenMap(): SeenMap {
  try {
    const parsed = JSON.parse(String(uni.getStorageSync(SEEN_KEY) || ''))
    if (parsed && Array.isArray(parsed.pending)) return parsed
  } catch {}
  return { pending: [], passed: [], rejected: [] }
}

const seenMap = ref<SeenMap>(loadSeenMap())

// 首次使用（无已读记录）时历史订单计为未读，点击对应状态后清零
const unreadCount = (key: StatusKey) => statusIds(key).filter((id) => !seenMap.value[key].includes(id)).length

const counts = computed<Record<FilterKey, number>>(() => ({
  all: 0, // 全部不显示徽标
  pending: 0, // 审核中不显示徽标（数量由首页入口角标承担）
  passed: unreadCount('passed'),
  rejected: unreadCount('rejected')
}))

function switchFilter(key: FilterKey) {
  filter.value = key
  markSeen(key)
}

function markSeen(key: FilterKey) {
  // 点「全部」= 两个提醒状态一并已读；审核中无徽标不参与
  const keys: StatusKey[] = key === 'all' ? ['passed', 'rejected'] : [key as StatusKey].filter((k) => k !== 'pending')
  if (keys.length === 0) return
  const next: SeenMap = { ...seenMap.value }
  for (const k of keys) {
    next[k] = Array.from(new Set([...next[k], ...statusIds(k)])).slice(-300)
  }
  seenMap.value = next
  uni.setStorageSync(SEEN_KEY, JSON.stringify(next))
}

/** 首页「兑换记录」入口带 filter=pending 直落审核中视图；数据到位后视同点击标签标记已读（一次性，返回刷新不重复标） */
let entryMark: FilterKey | null = null
onLoad((query) => {
  const value = String(query?.filter || '') as FilterKey
  if (['all', 'pending', 'passed', 'rejected'].includes(value)) {
    filter.value = value
    entryMark = value
  }
})

onShow(async () => {
  try {
    orders.value = await fetchOrders()
    // 首页/底栏「兑换记录」角标口径保持：审核中订单总数（未读语义只用于本页标签）
    homeBadges.orders = statusIds('pending').length
    if (entryMark) {
      markSeen(entryMark)
      entryMark = null
    }
  } catch (error) {
    uni.showToast({ title: (error as Error)?.message || '加载失败', icon: 'none' })
  }
})

function statusPill(order: Order) {
  const status = String(order.status || '')
  if (status === 'pending_review') return { label: '审核中', cls: 'amber', icon: 'refresh', tile: 'amber' }
  if (status === 'approved' || status === 'shipped' || status === 'completed') return { label: '已通过', cls: 'green', icon: 'check-circle', tile: 'green' }
  if (status === 'rejected') return { label: '已驳回', cls: 'red', icon: 'x-circle', tile: 'red' }
  if (status === 'cancelled') return { label: '已取消', cls: '', icon: 'x-circle', tile: '' }
  return { label: status || '未知', cls: '', icon: 'refresh', tile: '' }
}

/** 驳回订单直达申诉提交页（PRD 4.2；targetType=order，契约 7.1） */
function appealOrder(order: Order) {
  const query = [
    'targetType=order',
    `targetId=${order.id}`,
    `remark=${encodeURIComponent(order.giftName || '礼品兑换')}`,
    `points=${-(Number(order.pointsCost || 0))}`
  ].join('&')
  uni.navigateTo({ url: `/pages/appeal/index?${query}` })
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="兑换记录" />

    <view class="segmented">
      <text
        v-for="item in filters"
        :key="item.key"
        class="tab"
        :class="{ active: filter === item.key }"
        @tap="switchFilter(item.key)"
      >{{ item.label }}<text v-if="counts[item.key] > 0" class="tab-badge">{{ counts[item.key] > 99 ? '99+' : counts[item.key] }}</text></text>
    </view>

    <view v-for="order in visibleOrders" :key="order.id" class="card order-card">
      <view class="row order-head">
        <view class="icon-tile order-icon" :class="statusPill(order).tile">
          <AppIcon :name="statusPill(order).icon" :size="26" :color="statusPill(order).cls || 'muted'" />
        </view>
        <text class="order-name">{{ order.giftName }}</text>
        <text class="pill order-pill" :class="statusPill(order).cls">{{ statusPill(order).label }}</text>
      </view>
      <text class="muted order-sub">{{ formatTime(order.createdAt || order.occurredAt) }} · {{ formatPoints(order.pointsSpent || order.pointsCost) }}积分</text>
      <view v-if="order.status === 'rejected'" class="reject-row">
        <text class="reject-reason">原因：{{ order.remark || '暂无处理说明' }}</text>
        <view class="small-button" @tap="appealOrder(order)">发起申诉</view>
      </view>
    </view>

    <view v-if="visibleOrders.length === 0" class="card card-empty"><EmptyState icon="shopping-bag" title="暂无兑换记录" /></view>
    <view v-if="visibleOrders.length > 0" class="list-footer">已展示全部兑换记录</view>

    <AppTabBar />
  </view>
</template>

<style scoped>
/* 筛选标签数字徽标（样式对齐首页快捷入口 .shortcut-badge） */
.tab-badge {
  display: inline-block;
  margin-left: 6rpx;
  min-width: 28rpx;
  height: 28rpx;
  line-height: 28rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: var(--red);
  color: #fff;
  font-size: 18rpx;
  font-weight: 600;
  text-align: center;
  box-sizing: border-box;
  vertical-align: middle;
}

.order-card {
  padding: 26rpx 28rpx;
}

.order-head {
  gap: 16rpx;
}

.order-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  font-size: 26rpx;
  font-weight: 700;
}

.order-name {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-pill {
  flex-shrink: 0;
}

.order-sub {
  display: block;
  margin-top: 10rpx;
}

.reject-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 16rpx;
}

.reject-reason {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: var(--red);
  line-height: 1.5;
}

.list-footer {
  text-align: center;
  padding: 8rpx 0;
  font-size: 22rpx;
  color: var(--faint);
}
</style>
