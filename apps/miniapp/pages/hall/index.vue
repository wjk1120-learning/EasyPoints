<script setup>
import { reactive, ref } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { requestPaged } from '../../api'

const rows = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = 50
const total = ref(null)

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
  pointsTypeIndex: 0,
  keyword: ''
})

onShow(async () => {
  await refresh()
  markSeen()
})

onPullDownRefresh(async () => {
  await refresh()
  uni.stopPullDownRefresh()
})

onReachBottom(async () => {
  await loadMore()
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

function buildQuery(pageNo) {
  const params = [`page=${pageNo}`, `pageSize=${pageSize}`]
  if (filters.month) params.push(`month=${encodeURIComponent(filters.month)}`)
  if (filters.pointsDirection) params.push(`pointsDirection=${encodeURIComponent(filters.pointsDirection)}`)
  const keyword = String(filters.keyword || '').trim()
  if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`)
  return params.join('&')
}

async function refresh() {
  page.value = 1
  total.value = null
  rows.value = []
  await loadMore()
}

async function search() {
  await refresh()
}

function onMonthChange(event) {
  const index = Number(event.detail.value || 0)
  filters.monthIndex = index
  filters.month = monthOptions[index]?.value || ''
  search()
}

function onPointsTypeChange(event) {
  const index = Number(event.detail.value || 0)
  filters.pointsTypeIndex = index
  filters.pointsDirection = pointsTypeOptions[index]?.value || ''
  search()
}

function resetFilters() {
  filters.month = ''
  filters.monthIndex = 0
  filters.pointsDirection = ''
  filters.pointsTypeIndex = 0
  filters.keyword = ''
  search()
}

function markSeen() {
  const latest = rows.value[0]
  if (latest && latest.occurredAt) {
    uni.setStorageSync('hallSeenAt', String(latest.occurredAt))
  } else if (!uni.getStorageSync('hallSeenAt')) {
    uni.setStorageSync('hallSeenAt', new Date().toISOString())
  }
  try {
    uni.removeTabBarBadge({ index: 1 })
  } catch {}
}

async function loadMore() {
  if (loading.value) return
  if (total.value != null && rows.value.length >= total.value) return
  loading.value = true
  try {
    const result = await requestPaged(`/miniapp/hall?${buildQuery(page.value)}`)
    const data = Array.isArray(result.data) ? result.data : []
    rows.value = rows.value.concat(data)
    if (result.meta && Number.isFinite(Number(result.meta.total))) total.value = Number(result.meta.total)
    page.value += 1
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
</script>

<template>
  <view class="page page-tab">
    <view class="card filter-panel">
      <text class="section-label">筛选</text>
      <view class="filter-row" style="margin-top: 12rpx; margin-bottom: 16rpx">
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
      <view class="filter-row" style="margin-bottom: 12rpx">
        <input
          v-model="filters.keyword"
          class="keyword-input"
          placeholder="输入员工姓名或ID"
          confirm-type="search"
          @confirm="search"
        />
        <view class="search-button" @tap="search">搜索</view>
      </view>
      <view class="reset-link" @tap="resetFilters">重置筛选</view>
    </view>

    <view class="card record-card" v-for="item in rows" :key="item.id">
      <view class="row between">
        <text class="record-name">{{ item.employeeName || `员工 ${item.employeeId}` }}</text>
        <text class="record-delta" :class="item.pointsDelta > 0 ? 'pos' : 'neg'">
          {{ item.pointsDelta > 0 ? '+' : '' }}{{ item.pointsDelta }}
        </text>
      </view>
      <text class="record-remark">{{ item.remark }}</text>
      <text class="muted record-meta">
        {{ formatTime(item.occurredAt) }} · {{ item.operatorName || '系统' }}
      </text>
    </view>

    <view v-if="!loading && rows.length === 0" class="card card-empty">
      <text class="muted">暂无符合条件的记录</text>
    </view>
    <view v-if="loading" class="card card-empty">
      <text class="muted">加载中...</text>
    </view>
    <view v-if="!loading && total != null && rows.length >= total && total > 0" class="card card-empty">
      <text class="muted">已加载全部</text>
    </view>
  </view>
</template>

<style scoped>
.filter-panel {
  padding-bottom: 24rpx;
}

.record-name {
  font-size: 30rpx;
  font-weight: 600;
}

.record-delta {
  font-size: 32rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.record-remark {
  display: block;
  margin-top: 14rpx;
  font-size: 28rpx;
  line-height: 1.65;
  color: #3a3a3c;
}

.record-meta {
  display: block;
  margin-top: 14rpx;
}
</style>
