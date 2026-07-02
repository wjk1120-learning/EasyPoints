<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '../../api'

const groups = ref({})

onShow(async () => {
  try {
    groups.value = await request('/miniapp/points/records')
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  }
})

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

function appeal(record) {
  uni.navigateTo({
    url: `/pages/appeal/index?recordId=${record.id}&remark=${encodeURIComponent(record.remark)}`
  })
}
</script>

<template>
  <view class="page">
    <view class="card" v-for="month in Object.keys(groups)" :key="month">
      <view class="row between" style="margin-bottom: 20rpx">
        <text class="muted">{{ month }}</text>
      </view>
      <view v-for="record in groups[month]" :key="record.id" class="row between" style="padding: 18rpx 0; border-top: 1px solid #f2f2f2">
        <view>
          <text style="font-weight: 500">{{ record.remark }}</text>
          <text class="muted" style="margin-top: 8rpx; display: block">
            {{ formatTime(record.createdAt) }}
          </text>
        </view>
        <view style="text-align: right">
          <text :style="{ color: record.pointsDelta > 0 ? '#00a870' : '#e54b4f', fontWeight: 600 }">
            {{ record.pointsDelta > 0 ? '+' : '' }}{{ record.pointsDelta }}
          </text>
          <text class="muted" style="font-size: 24rpx; display: block; margin-top: 6rpx" @tap="appeal(record)">申诉</text>
        </view>
      </view>
    </view>
    <view v-if="Object.keys(groups).length === 0" class="card">
      <text class="muted">暂无积分记录</text>
    </view>
  </view>
</template>

<style>
</style>
