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
    <view class="card" v-for="o in orders" :key="o.id">
      <view class="row between">
        <text style="font-weight: 500">兑换：{{ o.giftName }}</text>
        <text style="font-weight: 600; color: #00a870">
          -{{ o.pointsSpent }}
        </text>
      </view>
      <view class="row between" style="margin-top: 12rpx">
        <text class="muted">订单状态</text>
        <text class="muted">{{ formatOrderStatus(o.status) }}</text>
      </view>
    </view>
    <view class="card" v-if="orders.length === 0">
      <text class="muted">暂无订单</text>
    </view>
  </view>
</template>

<style>
</style>
