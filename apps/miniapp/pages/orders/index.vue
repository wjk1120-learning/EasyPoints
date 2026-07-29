<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '../../api'

const orders = ref([])

onShow(async () => {
  try {
    orders.value = await request('/miniapp/orders')
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  }
})

function formatOrderStatus(value) {
  const status = String(value || '')
  if (status === 'pending_review') return '待审核'
  if (status === 'approved') return '已通过'
  if (status === 'shipped') return '已发货'
  if (status === 'completed') return '已完成'
  if (status === 'rejected') return '已驳回'
  if (status === 'cancelled') return '已取消'
  return status
}
</script>

<template>
  <view class="page">
    <view class="card order-card" v-for="o in orders" :key="o.id">
      <view class="row between">
        <text class="order-gift">兑换 · {{ o.giftName }}</text>
        <text class="order-points neg">-{{ o.pointsSpent }}</text>
      </view>
      <view class="row between order-footer">
        <text class="muted">订单状态</text>
        <text class="status-pill">{{ formatOrderStatus(o.status) }}</text>
      </view>
    </view>
    <view class="card card-empty" v-if="orders.length === 0">
      <text class="muted">暂无订单</text>
    </view>
  </view>
</template>

<style scoped>
.order-gift {
  font-size: 30rpx;
  font-weight: 600;
  color: #1c1c1e;
}

.order-points {
  font-size: 32rpx;
  font-weight: 700;
}

.order-footer {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid rgba(91, 155, 213, 0.08);
}
</style>
