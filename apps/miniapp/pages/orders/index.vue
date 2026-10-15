<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { fetchOrders } from '../../api/order/order'
import type { Order } from '../../api/order/types'
import { formatPoints, formatTime } from '../../utils/format'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

type FilterKey = 'all' | 'pending' | 'passed' | 'rejected'

const orders = ref<Order[]>([])
const filter = ref<FilterKey>('all')

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '审核中' },
  { key: 'passed', label: '已通过' },
  { key: 'rejected', label: '已驳回' }
]

const visibleOrders = computed(() => {
  if (filter.value === 'pending') return orders.value.filter((item) => item.status === 'pending_review')
  if (filter.value === 'passed') return orders.value.filter((item) => ['approved', 'shipped', 'completed'].includes(item.status || ''))
  if (filter.value === 'rejected') return orders.value.filter((item) => ['rejected', 'cancelled'].includes(item.status || ''))
  return orders.value
})

onShow(async () => {
  try {
    orders.value = await fetchOrders()
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
        @tap="filter = item.key"
      >{{ item.label }}</text>
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
