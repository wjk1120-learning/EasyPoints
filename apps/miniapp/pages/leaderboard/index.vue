<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '../../api'
import AiFloatBall from '../../components/AiFloatBall.vue'
import NavBar from '../../components/NavBar.vue'

const list = ref([])
const loading = ref(false)
const rankBy = ref('actual')
const sameBoard = ref(true)
const updatedAt = ref('')

const PASTELS = [
  { bg: '#eaf3ff', fg: '#2f6bff' },
  { bg: '#e9f7ef', fg: '#16a34a' },
  { bg: '#fff6e5', fg: '#d97706' },
  { bg: '#f1edff', fg: '#7c5cbf' },
  { bg: '#fdeeee', fg: '#f04438' }
]

const medalColors = { 1: '#ffb020', 2: '#a8b4c4', 3: '#d9925f' }

const myEntry = computed(() => {
  const employeeId = String(uni.getStorageSync('employeeId') || '')
  if (!employeeId) return null
  return list.value.find((item) => String(item.id) === employeeId) || null
})

onShow(loadLeaderboard)

async function loadLeaderboard() {
  loading.value = true
  try {
    const data = await request(`/miniapp/leaderboard?rankBy=${rankBy.value}`)
    list.value = Array.isArray(data) ? data : []
    sameBoard.value = !list.value.some((item) => item.actualPoints != null && item.availablePoints != null)
    const now = new Date()
    updatedAt.value = `${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchRank(next) {
  if (rankBy.value === next) return
  rankBy.value = next
  loadLeaderboard()
}

function scoreOf(item) {
  if (rankBy.value === 'actual' && item.actualPoints != null) return item.actualPoints
  if (item.availablePoints != null) return item.availablePoints
  return item.pointsBalance
}

function nameInitial(name) {
  const text = String(name || '').trim()
  return text ? text.slice(0, 1) : '?'
}

function pastel(index) {
  return PASTELS[index % PASTELS.length]
}

function formatPoints(value) {
  const num = Number(value || 0)
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="积分排名" right="排行规则" @right="uni.navigateTo({ url: '/pages/rules/index' })" />

    <view class="segmented">
      <text class="tab" :class="{ active: rankBy === 'actual' }" @tap="switchRank('actual')">实际积分排名</text>
      <text class="tab" :class="{ active: rankBy === 'available' }" @tap="switchRank('available')">实时积分排名</text>
    </view>

    <text class="update-line">⟳ 数据更新于 {{ updatedAt || '--:--' }} 自动刷新</text>
    <text v-if="sameBoard" class="same-board-note">双榜字段待后端提供，两个页签暂展示同一份可用积分。</text>

    <view v-if="myEntry" class="card my-rank">
      <text class="my-rank-label">📍 我的排名 · 置顶</text>
      <view class="row my-rank-row">
        <text class="my-rank-num">{{ myEntry.rank }}</text>
        <view class="my-avatar" :style="{ background: pastel(myEntry.rank).bg, color: pastel(myEntry.rank).fg }">
          {{ nameInitial(myEntry.name) }}
        </view>
        <view class="my-info">
          <text class="my-name">{{ myEntry.name }}（我）</text>
          <text class="my-dept">{{ myEntry.departmentName || '-' }}</text>
        </view>
        <text class="my-points">{{ formatPoints(scoreOf(myEntry)) }}</text>
      </view>
    </view>

    <view class="card board">
      <view class="board-title">全员榜单</view>
      <view v-if="loading" class="board-empty"><text class="muted">加载中…</text></view>
      <view v-else-if="list.length === 0" class="board-empty"><text class="muted">暂无数据</text></view>
      <view v-for="(item, index) in list" :key="item.id" class="board-row">
        <view class="rank-badge">
          <view v-if="item.rank <= 3" class="medal" :style="{ background: medalColors[item.rank] }">{{ item.rank }}</view>
          <text v-else class="rank-num">{{ item.rank }}</text>
        </view>
        <view class="board-avatar" :style="{ background: pastel(index).bg, color: pastel(index).fg }">
          {{ nameInitial(item.name) }}
        </view>
        <view class="board-main">
          <text class="board-name">{{ item.name }}</text>
          <text class="board-dept">{{ item.departmentName || '-' }}</text>
        </view>
        <text class="board-points">{{ formatPoints(scoreOf(item)) }}</text>
      </view>
    </view>

    <AiFloatBall />
  </view>
</template>

<style scoped>
.update-line {
  display: block;
  text-align: center;
  margin: 16rpx 0 4rpx;
  font-size: 22rpx;
  color: #9aa1ab;
}

.same-board-note {
  display: block;
  text-align: center;
  margin-bottom: 8rpx;
  font-size: 20rpx;
  color: #b4bac3;
}

.my-rank {
  background: #edf3ff;
  box-shadow: none;
  padding: 24rpx 28rpx;
}

.my-rank-label {
  font-size: 22rpx;
  font-weight: 600;
  color: #2f6bff;
}

.my-rank-row {
  gap: 20rpx;
  margin-top: 18rpx;
}

.my-rank-num {
  font-size: 44rpx;
  font-weight: 800;
  color: #2f6bff;
  font-variant-numeric: tabular-nums;
  min-width: 56rpx;
  text-align: center;
}

.my-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
  flex-shrink: 0;
}

.my-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.my-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a2233;
}

.my-dept {
  font-size: 22rpx;
  color: #8a97b8;
}

.my-points {
  flex-shrink: 0;
  font-size: 32rpx;
  font-weight: 800;
  color: #1a2233;
  font-variant-numeric: tabular-nums;
}

.board-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a2233;
  margin-bottom: 8rpx;
}

.board-empty {
  padding: 48rpx 0;
  text-align: center;
}

.board-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 0;
  border-bottom: 1rpx solid #f5f6f8;
}

.board-row:last-of-type {
  border-bottom: none;
  padding-bottom: 4rpx;
}

.rank-badge {
  width: 48rpx;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.medal {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rank-num {
  font-size: 28rpx;
  font-weight: 500;
  color: #9aa1ab;
  font-variant-numeric: tabular-nums;
}

.board-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
  flex-shrink: 0;
}

.board-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.board-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a2233;
}

.board-dept {
  font-size: 22rpx;
  color: #9aa1ab;
}

.board-points {
  flex-shrink: 0;
  font-size: 30rpx;
  font-weight: 700;
  color: #1a2233;
  font-variant-numeric: tabular-nums;
}
</style>
