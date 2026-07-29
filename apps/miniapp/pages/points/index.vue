<script setup>
import { reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '../../api'
import AiFloatBall from '../../components/AiFloatBall.vue'

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
  <view class="page page-tab">
    <view class="card filter-panel">
      <text class="section-label">筛选</text>
      <view class="filter-row" style="margin-top: 12rpx">
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

    <view class="card month-group" v-for="month in Object.keys(groups)" :key="month">
      <text class="month-title">{{ month }}</text>
      <view v-for="record in groups[month]" :key="record.id" class="row between record-row">
        <view class="record-main">
          <text class="record-remark">{{ record.remark }}</text>
          <text class="muted record-time">{{ formatTime(record.createdAt) }}</text>
        </view>
        <view class="record-side">
          <text class="record-delta" :class="record.pointsDelta > 0 ? 'pos' : 'neg'">
            {{ record.pointsDelta > 0 ? '+' : '' }}{{ record.pointsDelta }}
          </text>
          <text class="appeal-link" @tap="appeal(record)">申诉</text>
        </view>
      </view>
    </view>

    <view v-if="loading" class="card card-empty">
      <text class="muted">加载中...</text>
    </view>
    <view v-if="!loading && Object.keys(groups).length === 0" class="card card-empty">
      <text class="muted">暂无符合条件的积分记录</text>
    </view>
    <AiFloatBall />
  </view>
</template>

<style scoped>
.filter-panel {
  padding-bottom: 24rpx;
}

.month-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #3a7ca5;
  margin-bottom: 8rpx;
}

.record-main {
  flex: 1;
  min-width: 0;
  padding-right: 24rpx;
}

.record-remark {
  font-size: 28rpx;
  font-weight: 500;
  color: #1c1c1e;
  line-height: 1.5;
}

.record-time {
  display: block;
  margin-top: 8rpx;
}

.record-side {
  text-align: right;
  flex-shrink: 0;
}

.record-delta {
  font-size: 32rpx;
  font-weight: 700;
}
</style>
