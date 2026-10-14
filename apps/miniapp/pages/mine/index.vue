<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '../../api'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AiFloatBall from '../../components/AiFloatBall.vue'
import AppIcon from '../../components/AppIcon.vue'

const home = ref({ pointsBalance: 0, monthDelta: 0, employee: {} })
const myRank = ref(null)

const services = [
  { label: '我的申请', icon: 'file-text', tile: 'purple', url: '/pages/apply/index' },
  { label: '兑换记录', icon: 'shopping-bag', tile: 'blue', url: '/pages/orders/index' },
  { label: '申诉记录', icon: 'shield', tile: 'amber', url: '/pages/appeals/index' },
  { label: '规则中心', icon: 'book-open', tile: 'green', url: '/pages/rules/index' },
  { label: '我的投票', icon: 'check-square', tile: 'purple', url: '/pages/votes/index' }
]

onShow(async () => {
  try {
    home.value = await request('/miniapp/home')
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  }
  loadRank()
})

async function loadRank() {
  try {
    const list = await request('/miniapp/leaderboard?rankBy=available')
    const employeeId = String(uni.getStorageSync('employeeId') || '')
    const mine = (Array.isArray(list) ? list : []).find((item) => String(item.id) === employeeId)
    myRank.value = mine ? mine.rank : null
  } catch {
    myRank.value = null
  }
}

function initial() {
  return String(home.value.employee?.name || '员').slice(0, 1)
}

function actualPoints() {
  const value = home.value.actualPoints ?? home.value.honorPoints
  return value == null || value === '' ? '—' : formatPoints(value)
}

function employeeTitle() {
  return home.value.employee?.title || home.value.employee?.position || home.value.employee?.employmentType || ''
}

function open(url) {
  uni.navigateTo({ url })
}

function formatPoints(value) {
  const num = Number(value || 0)
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
</script>

<template>
  <view class="page page-tab page-nav">
    <NavBar title="我的" :back="false" />

    <view class="card profile">
      <view class="avatar">{{ initial() }}</view>
      <view class="profile-main">
        <view class="row profile-name-row">
          <text class="name">{{ home.employee?.name || '员工' }}</text>
          <text v-if="employeeTitle()" class="pill blue">{{ employeeTitle() }}</text>
        </view>
        <text class="muted">{{ home.employee?.departmentName || '未分配部门' }}</text>
      </view>
    </view>

    <view class="card stats">
      <view class="stat">
        <text class="stat-num">{{ formatPoints(home.pointsBalance || 0) }}</text>
        <text class="stat-label">实时积分</text>
      </view>
      <view class="stat-divider" />
      <view class="stat">
        <text class="stat-num">{{ actualPoints() }}</text>
        <text class="stat-label">实际积分</text>
      </view>
      <view class="stat-divider" />
      <view class="stat">
        <text class="stat-num">{{ myRank == null ? '—' : myRank }}</text>
        <text class="stat-label">积分排名</text>
      </view>
    </view>

    <view class="card">
      <view class="block-title">我的服务</view>
      <view v-for="item in services" :key="item.label" class="service press" @tap="open(item.url)">
        <view class="icon-tile service-icon" :class="item.tile">
          <AppIcon :name="item.icon" :size="44" :color="item.tile === 'blue' ? 'brand' : item.tile" />
        </view>
        <text class="service-label">{{ item.label }}</text>
        <text class="service-chevron">›</text>
      </view>
    </view>

    <view class="card card-info safe-card">
      <view class="row safe-head">
        <AppIcon name="shield" :size="32" color="green" />
        <text class="safe-title">积分账户安全</text>
      </view>
      <text class="safe-body">积分数据与业务身份实时同步，如信息有误请联系系统积分管理员。</text>
    </view>

    <AiFloatBall />
    <AppTabBar />
  </view>
</template>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx 28rpx;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #2e6bf2, #5a8cff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.profile-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.profile-name-row {
  gap: 12rpx;
}

.name {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--ink);
}

.stats {
  display: flex;
  align-items: center;
  padding: 32rpx 16rpx;
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.stat-num {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 22rpx;
  color: var(--muted);
}

.stat-divider {
  width: 1rpx;
  height: 56rpx;
  background: var(--line-soft);
}

.block-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--ink);
}

.service {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--bg);
}

.service:last-of-type {
  border-bottom: none;
  padding-bottom: 4rpx;
}

.service:active {
  opacity: 0.8;
}

.service-icon {
  width: 68rpx;
  height: 68rpx;
  font-size: 30rpx;
}

.service-label {
  flex: 1;
  font-size: 28rpx;
  font-weight: 500;
  color: var(--ink);
}

.service-chevron {
  color: #c9cfd8;
  font-size: 32rpx;
}

.safe-card {
  padding: 24rpx 28rpx;
}

.safe-head {
  gap: 10rpx;
}

.safe-title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--brand);
}

.safe-body {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #6b7fa8;
  line-height: 1.6;
}
</style>
