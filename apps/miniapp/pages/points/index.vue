<script setup>
import { reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '../../api'

const groups = ref({})
const loading = ref(false)

const monthOptions = buildMonthOptions()
const pointsTypeOptions = [
  { label: '全部类型', value: '' },
  { label: '加分', value: 'positive' },
  { label: '扣分', value: 'negative' }
]

const filters = reactive({
  month: '',
  monthIndex: 0,
  pointsDirection: '',
  pointsTypeIndex: 0
})

onShow(async () => {
  await loadRecords()
})

function buildMonthOptions() {
  const options = [{ label: '全部月份', value: '' }]
  const now = new Date()
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    options.push({ label: `${date.getFullYear()}年${date.getMonth() + 1}月`, value })
  }
  return options
}

function buildQuery() {
  const params = []
  if (filters.month) params.push(`month=${encodeURIComponent(filters.month)}`)
  if (filters.pointsDirection) params.push(`pointsDirection=${encodeURIComponent(filters.pointsDirection)}`)
  return params.length ? `?${params.join('&')}` : ''
}

async function loadRecords() {
  loading.value = true
  try {
    groups.value = await request(`/miniapp/points/records${buildQuery()}`)
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function onMonthChange(event) {
  const index = Number(event.detail.value || 0)
  filters.monthIndex = index
  filters.month = monthOptions[index]?.value || ''
  loadRecords()
}

function onPointsTypeChange(event) {
  const index = Number(event.detail.value || 0)
  filters.pointsTypeIndex = index
  filters.pointsDirection = pointsTypeOptions[index]?.value || ''
  loadRecords()
}

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
    <view class="card filter-card">
      <view class="filter-row picker-row">
        <view class="picker-wrap">
          <picker mode="selector" :range="monthOptions" range-key="label" :value="filters.monthIndex" @change="onMonthChange">
            <view class="picker-field">
              <text class="picker-label">{{ monthOptions[filters.monthIndex].label }}</text>
              <text class="arrow">▼</text>
            </view>
          </picker>
        </view>
        <view class="picker-wrap">
          <picker mode="selector" :range="pointsTypeOptions" range-key="label" :value="filters.pointsTypeIndex" @change="onPointsTypeChange">
            <view class="picker-field">
              <text class="picker-label">{{ pointsTypeOptions[filters.pointsTypeIndex].label }}</text>
              <text class="arrow">▼</text>
            </view>
          </picker>
        </view>
      </view>
    </view>

    <view class="card" v-for="month in Object.keys(groups)" :key="month">
      <view class="row between" style="margin-bottom: 20rpx">
        <text class="muted">{{ month }}</text>
      </view>
      <view v-for="record in groups[month]" :key="record.id" class="row between record-row">
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
          <text class="muted appeal-link" @tap="appeal(record)">申诉</text>
        </view>
      </view>
    </view>
    <view v-if="loading" class="card">
      <text class="muted">加载中...</text>
    </view>
    <view v-if="!loading && Object.keys(groups).length === 0" class="card">
      <text class="muted">暂无符合条件的积分记录</text>
    </view>
  </view>
</template>

<style scoped>
.filter-card {
  padding-bottom: 24rpx;
}

.filter-row {
  display: flex;
  align-items: stretch;
  gap: 16rpx;
  width: 100%;
  box-sizing: border-box;
}

.picker-wrap {
  flex: 1;
  min-width: 0;
}

.picker-wrap picker {
  display: block;
  width: 100%;
}

.picker-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 72rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12rpx;
  font-size: 26rpx;
}

.picker-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1f2937;
}

.arrow {
  margin-left: 12rpx;
  color: #9ca3af;
  font-size: 20rpx;
  flex-shrink: 0;
}

.record-row {
  padding: 18rpx 0;
  border-top: 1px solid #f2f2f2;
}

.appeal-link {
  font-size: 24rpx;
  display: block;
  margin-top: 6rpx;
}
</style>
