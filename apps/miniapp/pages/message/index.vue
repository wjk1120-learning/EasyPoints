<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AiFloatBall from '../../components/AiFloatBall.vue'
import AppIcon from '../../components/AppIcon.vue'

const message = ref({ title: '', summary: '', type: '', createdAt: '' })

onLoad((query) => {
  message.value = {
    title: decodeURIComponent(query?.title || '系统通知'),
    summary: decodeURIComponent(query?.summary || ''),
    type: decodeURIComponent(query?.type || ''),
    createdAt: decodeURIComponent(query?.createdAt || '')
  }
})

function typeMeta() {
  const text = `${message.value.type || ''} ${message.value.title || ''} ${message.value.summary || ''}`
  if (message.value.type === 'vote_assigned' || message.value.type === 'vote' || /投票/.test(text)) {
    return { label: '投票', cls: 'purple' }
  }
  if (message.value.type === 'order_status' || /兑换|订单/.test(text)) {
    return { label: '兑换审核', cls: 'blue' }
  }
  if (/任务/.test(text)) {
    return { label: '任务审核', cls: 'amber' }
  }
  if (/申诉/.test(text)) {
    return { label: '申诉结果', cls: 'green' }
  }
  if (/申请/.test(text)) {
    return { label: '积分申请', cls: 'purple' }
  }
  return { label: '积分变动', cls: 'blue' }
}

function canAppeal() {
  return /驳回|扣分|申诉/.test(`${message.value.title}${message.value.summary}`)
}

function isVote() {
  return typeMeta().label === '投票'
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  return `${m}-${d} ${hh}:${mm}`
}

function goAppeal() {
  uni.switchTab({ url: '/pages/points/index' })
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="消息详情" />

    <view class="card">
      <view class="row between">
        <text class="pill" :class="typeMeta().cls">{{ typeMeta().label }}</text>
        <text class="muted">{{ formatTime(message.createdAt) }}</text>
      </view>
      <text class="title">{{ message.title }}</text>
      <text class="body">{{ message.summary }}</text>
    </view>

    <view v-if="canAppeal()" class="notice-amber">
      <AppIcon name="lightbulb" :size="32" color="amber" />
      <text>如对审核结果有异议，可在 7 日内发起申诉。</text>
    </view>

    <view v-if="canAppeal()" class="button" @tap="goAppeal">发起申诉</view>
    <text v-if="canAppeal()" class="muted tip">申诉需绑定本人积分流水，请在积分明细中选择对应记录后发起。</text>

    <view v-if="isVote()" class="button ghost" @tap="uni.navigateTo({ url: '/pages/votes/index' })">查看投票</view>

    <AiFloatBall />
    <AppTabBar />
  </view>
</template>

<style scoped>
.title {
  display: block;
  margin-top: 24rpx;
  font-size: 38rpx;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.4;
}

.body {
  display: block;
  margin-top: 20rpx;
  font-size: 28rpx;
  color: #344156;
  line-height: 1.7;
}

.notice-amber {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: #fff8e8;
  color: #b45309;
  font-size: 24rpx;
  line-height: 1.6;
}

.tip {
  display: block;
  margin-top: 16rpx;
  text-align: center;
}

.button.ghost {
  margin-top: 20rpx;
}
</style>
