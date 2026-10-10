<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { isMissingApi, request } from '../../api'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AiFloatBall from '../../components/AiFloatBall.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

const tab = ref('all')
const rows = ref([])
const missing = ref('')

const isDone = (item) => /approved|rejected|通过|驳回|维持/.test(`${item.status || ''}${item.statusText || ''}`)

const visibleRows = computed(() => {
  if (tab.value === 'pending') return rows.value.filter((item) => !isDone(item))
  if (tab.value === 'done') return rows.value.filter(isDone)
  return rows.value
})

onShow(load)

async function load() {
  try {
    const data = await request('/miniapp/appeals')
    rows.value = Array.isArray(data) ? data : []
    missing.value = ''
  } catch (error) {
    rows.value = []
    missing.value = isMissingApi(error)
      ? '申诉记录接口尚未提供。提交仍走已有 POST /miniapp/appeals，且必须带本人流水 pointRecordId。'
      : (error?.message || '加载失败')
  }
}

function switchTab(next) {
  tab.value = next
}

function statusPill(item) {
  const text = `${item.status || ''}${item.statusText || ''}`
  if (/approved|通过/.test(text)) return { label: '申诉通过', cls: 'green' }
  if (/rejected|驳回/.test(text)) return { label: '已驳回', cls: 'red' }
  if (/维持/.test(text)) return { label: '维持原判', cls: 'red' }
  if (/pending|processing|待|处理/.test(text)) return { label: item.statusText || '处理中', cls: 'amber' }
  return { label: item.statusText || item.status || '处理中', cls: 'amber' }
}

function bannerOf(item) {
  const text = `${item.status || ''}${item.statusText || ''}`
  if (/approved|通过/.test(text)) return { cls: 'banner-green', icon: 'check-circle', text: '申诉通过，积分已按结论调整' }
  if (/rejected|驳回/.test(text)) {
    const reason = item.resolution || item.reviewRemark || item.result
    return { cls: 'banner-red', icon: 'x-circle', text: reason ? `处理意见：${reason}` : '申诉未通过，如有疑问联系积分管理员' }
  }
  if (/维持/.test(text)) {
    const reason = item.resolution || item.reviewRemark || item.result
    return { cls: 'banner-red', icon: 'x-circle', text: reason ? `处理意见：${reason}` : '维持原判' }
  }
  return { cls: 'banner-amber', icon: 'clock', text: '预计 3 个工作日内完成处理' }
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  return `${m}-${d} ${hh}:${mm}`
}

function titleOf(item) {
  return item.reason || item.remark || `申诉 #${item.pointRecordId ?? item.id}`
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="申诉记录" />

    <view class="segmented">
      <text class="tab" :class="{ active: tab === 'all' }" @tap="switchTab('all')">全部</text>
      <text class="tab" :class="{ active: tab === 'pending' }" @tap="switchTab('pending')">处理中</text>
      <text class="tab" :class="{ active: tab === 'done' }" @tap="switchTab('done')">已完成</text>
    </view>

    <view v-if="missing" class="card"><text class="muted">{{ missing }}</text></view>

    <template v-else>
      <view v-for="item in visibleRows" :key="item.id" class="card appeal-card">
        <view class="row between">
          <text class="appeal-title">{{ titleOf(item) }}</text>
          <text class="pill" :class="statusPill(item).cls">{{ statusPill(item).label }}</text>
        </view>
        <text class="muted appeal-sub">申诉 · {{ formatDate(item.createdAt) }}</text>
        <view class="banner" :class="bannerOf(item).cls">
          <AppIcon
            :name="bannerOf(item).icon"
            :size="36"
            :color="bannerOf(item).cls === 'banner-green' ? 'green' : bannerOf(item).cls === 'banner-red' ? 'red' : 'amber'"
          />
          <text class="banner-text">{{ bannerOf(item).text }}</text>
        </view>
      </view>
      <view v-if="visibleRows.length === 0" class="card card-empty"><EmptyState icon="shield" title="暂无申诉记录" /></view>
      <view v-if="visibleRows.length > 0" class="list-footer">已展示全部申诉记录</view>
    </template>

    <view class="footer-link" @tap="uni.switchTab({ url: '/pages/points/index' })">从积分明细发起新申诉 ›</view>

    <AiFloatBall />
    <AppTabBar />
  </view>
</template>

<style scoped>
.appeal-card {
  padding: 28rpx;
}

.appeal-title {
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

.appeal-sub {
  display: block;
  margin-top: 8rpx;
}

.banner {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  margin-top: 20rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
}

.banner-amber {
  background: var(--amber-soft);
  color: #b45309;
}

.banner-green {
  background: var(--green-soft);
  color: var(--green);
}

.banner-red {
  background: var(--red-soft);
  color: var(--red);
}

.banner-text {
  flex: 1;
  min-width: 0;
}

.list-footer {
  text-align: center;
  padding: 8rpx 0;
  font-size: 22rpx;
  color: var(--faint);
}

.footer-link {
  text-align: center;
  padding: 16rpx 0;
  font-size: 24rpx;
  color: var(--brand);
}

.footer-link:active {
  opacity: 0.6;
}
</style>
