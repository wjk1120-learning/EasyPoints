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
  <view class="page page-tab">
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
/* ---- header card (hero style) ---- */
.lb-header {
  padding: 32rpx;
  margin-bottom: 20rpx;
  border-radius: 28rpx;
  background: linear-gradient(145deg, rgba(168, 230, 207, 0.42), rgba(168, 216, 234, 0.48));
  border: 1rpx solid rgba(255, 255, 255, 0.75);
  box-shadow:
    0 12rpx 40rpx rgba(107, 203, 154, 0.12),
    0 1rpx 0 rgba(255, 255, 255, 0.8) inset;
}

.lb-title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #3a7ca5;
  letter-spacing: -0.5rpx;
  line-height: 1.15;
}

.lb-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8e8e93;
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
  gap: 16rpx;
}

.lb-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.62);
  border: 1rpx solid rgba(255, 255, 255, 0.88);
  box-shadow:
    0 8rpx 32rpx rgba(91, 155, 213, 0.07),
    0 1rpx 0 rgba(255, 255, 255, 0.95) inset;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  transition: all 0.2s ease;
}

.lb-row:active {
  opacity: 0.92;
  transform: scale(0.992);
}

.lb-row.is-podium {
  background: linear-gradient(145deg, rgba(168, 230, 207, 0.35), rgba(168, 216, 234, 0.38));
  border: 1rpx solid rgba(255, 255, 255, 0.75);
}

/* ---- rank number ---- */
.lb-rank {
  width: 40rpx;
  flex-shrink: 0;
  text-align: center;
  font-size: 24rpx;
  font-weight: 500;
  color: #aeaeb2;
  font-variant-numeric: tabular-nums;
}

.lb-rank.is-first {
  font-size: 26rpx;
  font-weight: 700;
  color: #3a7ca5;
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
  background: rgba(142, 142, 147, 0.12);
}

.lb-avatar.is-podium-avatar {
  background: linear-gradient(135deg, #6bcb9a, #5b9bd5);
}

.lb-initial {
  font-size: 24rpx;
  font-weight: 600;
  color: #8e8e93;
}

.is-podium-avatar .lb-initial {
  color: #ffffff;
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
  color: #1c1c1e;
  line-height: 1.3;
}

.lb-dept {
  font-size: 22rpx;
  color: #8e8e93;
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
  color: #1c1c1e;
  font-variant-numeric: tabular-nums;
}

.lb-unit {
  font-size: 22rpx;
  color: #aeaeb2;
}
</style>
