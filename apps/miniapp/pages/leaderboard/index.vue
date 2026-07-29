<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '../../api'
import AiFloatBall from '../../components/AiFloatBall.vue'

const list = ref([])
const loading = ref(false)

onShow(async () => {
  await loadLeaderboard()
})

async function loadLeaderboard() {
  loading.value = true
  try {
    list.value = await request('/miniapp/leaderboard')
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function nameInitial(name) {
  const text = String(name || '').trim()
  return text ? text.slice(0, 1) : '?'
}
</script>

<template>
  <view class="page page-tab lb-page">
    <view class="lb-header">
      <text class="lb-title">排行榜</text>
      <text class="lb-desc">按当前积分降序排列</text>
    </view>

    <view v-if="loading" class="lb-empty">
      <text class="muted">加载中…</text>
    </view>

    <view v-else-if="list.length === 0" class="lb-empty">
      <text class="muted">暂无数据</text>
    </view>

    <view v-else class="lb-list">
      <view
        v-for="item in list"
        :key="item.id"
        class="lb-row"
        :class="{ 'is-podium': item.rank <= 3 }"
      >
        <text class="lb-rank" :class="item.rank === 1 ? 'is-first' : ''">{{ item.rank }}</text>
        <view class="lb-avatar" :class="item.rank <= 3 ? 'is-podium-avatar' : ''">
          <text class="lb-initial">{{ nameInitial(item.name) }}</text>
        </view>
        <view class="lb-body">
          <text class="lb-name">{{ item.name }}</text>
          <text class="lb-dept">{{ item.departmentName || '-' }}</text>
        </view>
        <view class="lb-score">
          <text class="lb-points">{{ item.pointsBalance }}</text>
          <text class="lb-unit">分</text>
        </view>
      </view>
    </view>

    <AiFloatBall />
  </view>
</template>

<style scoped>
.lb-page {
  padding-top: 24rpx;
}

/* ---- header ---- */
.lb-header {
  padding: 32rpx 16rpx 24rpx;
}

.lb-title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #020617;
  letter-spacing: -0.5rpx;
  line-height: 1.15;
}

.lb-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #64748B;
}

/* ---- empty ---- */
.lb-empty {
  padding: 80rpx 0;
  text-align: center;
}

/* ---- list ---- */
.lb-list {
  display: flex;
  flex-direction: column;
  border-top: 2rpx solid #E2E8F0;
}

.lb-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx 8rpx;
  background: #FFFFFF;
  border-bottom: 2rpx solid #E2E8F0;
  position: relative;
  transition: background 200ms ease;
}

.lb-row:active {
  background: #F1F5F9;
}

.lb-row.is-podium {
  padding: 24rpx;
}

/* #1 gets accent left border */
.lb-row:first-child {
  border-left: 6rpx solid #0369A1;
  padding-left: 18rpx;
  margin-left: -2rpx;
}

/* ---- rank number ---- */
.lb-rank {
  width: 40rpx;
  flex-shrink: 0;
  text-align: center;
  font-size: 24rpx;
  font-weight: 500;
  color: #94A3B8;
  font-variant-numeric: tabular-nums;
}

.lb-rank.is-first {
  font-size: 26rpx;
  font-weight: 700;
  color: #020617;
}

/* ---- avatar ---- */
.lb-avatar {
  width: 64rpx;
  height: 64rpx;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #E2E8F0;
}

.lb-avatar.is-podium-avatar {
  background: #0F172A;
}

.lb-initial {
  font-size: 24rpx;
  font-weight: 600;
  color: #64748B;
}

.is-podium-avatar .lb-initial {
  color: #FFFFFF;
}

/* ---- body ---- */
.lb-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.lb-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #020617;
  line-height: 1.3;
}

.lb-dept {
  font-size: 22rpx;
  color: #94A3B8;
}

/* ---- score ---- */
.lb-score {
  flex-shrink: 0;
  text-align: right;
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}

.lb-points {
  font-size: 30rpx;
  font-weight: 700;
  color: #020617;
  font-variant-numeric: tabular-nums;
}

.lb-unit {
  font-size: 22rpx;
  color: #94A3B8;
}
</style>
