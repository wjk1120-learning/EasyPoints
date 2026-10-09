<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '../../api'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'

const orders = ref([])
const filter = ref('all')

const filters = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '审核中' },
  { key: 'passed', label: '已通过' },
  { key: 'rejected', label: '已驳回' }
]

const visibleOrders = computed(() => {
  if (filter.value === 'pending') return orders.value.filter((item) => item.status === 'pending_review')
  if (filter.value === 'passed') return orders.value.filter((item) => ['approved', 'shipped', 'completed'].includes(item.status))
  if (filter.value === 'rejected') return orders.value.filter((item) => ['rejected', 'cancelled'].includes(item.status))
  return orders.value
})

onShow(async () => {
  try {
    orders.value = await request('/miniapp/orders')
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  }
})

function statusPill(order) {
  const status = String(order.status || '')
  if (status === 'pending_review') return { label: '审核中', cls: 'amber', icon: '⏱', tile: 'amber' }
  if (status === 'approved' || status === 'shipped' || status === 'completed') return { label: '已通过', cls: 'green', icon: '✓', tile: 'green' }
  if (status === 'rejected') return { label: '已驳回', cls: 'red', icon: '✕', tile: 'red' }
  if (status === 'cancelled') return { label: '已取消', cls: '', icon: '✕', tile: '' }
  return { label: status || '未知', cls: '', icon: '⏱', tile: '' }
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  return `${m}-${d} ${hh}:${mm}`
}

function appealHint() {
  uni.showModal({
    title: '发起申诉',
    content: '申诉需绑定本人积分流水，请在「积分明细」中选择对应兑换流水后发起。',
    confirmText: '去明细',
    success(res) {
      if (res.confirm) uni.switchTab({ url: '/pages/points/index' })
    }
  })
}

function formatPoints(value) {
  const num = Number(value || 0)
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
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
        <view class="icon-tile order-icon" :class="statusPill(order).tile">{{ statusPill(order).icon }}</view>
        <text class="order-name">{{ order.giftName }}</text>
        <text class="pill order-pill" :class="statusPill(order).cls">{{ statusPill(order).label }}</text>
      </view>
      <text class="muted order-sub">{{ formatTime(order.createdAt || order.occurredAt) }} · {{ formatPoints(order.pointsSpent || order.pointsCost) }}积分</text>
      <view v-if="order.status === 'rejected'" class="reject-row">
        <text class="reject-reason">原因：{{ order.reviewRemark || '暂无处理说明' }}</text>
        <view class="small-button" @tap="appealHint">发起申诉</view>
      </view>
    </view>

    <view v-if="visibleOrders.length === 0" class="card card-empty"><text class="muted">暂无兑换记录</text></view>
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
  color: #1a2233;
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
  color: #f04438;
  line-height: 1.5;
}

.list-footer {
  text-align: center;
  padding: 8rpx 0;
  font-size: 22rpx;
  color: #b4bac3;
}
</style>
