<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import { formatTime, splitMessageSummary } from '../../utils/format'

/** 深链业务 ID（契约 10.1/v4.4：后端从 payload 提升的顶层字段；有值时「发起申诉」直达申诉表单） */
const message = ref({
  title: '',
  summary: '',
  type: '',
  createdAt: '',
  applicationId: 0,
  orderId: 0,
  claimId: 0,
  pointRecordId: 0,
  ruleId: 0
})

onLoad((query) => {
  message.value = {
    title: decodeURIComponent(query?.title || '系统通知'),
    summary: decodeURIComponent(query?.summary || ''),
    type: decodeURIComponent(query?.type || ''),
    createdAt: decodeURIComponent(query?.createdAt || ''),
    applicationId: Number(query?.applicationId) || 0,
    orderId: Number(query?.orderId) || 0,
    claimId: Number(query?.claimId) || 0,
    pointRecordId: Number(query?.pointRecordId) || 0,
    ruleId: Number(query?.ruleId) || 0
  }
})

function typeMeta() {
  const text = `${message.value.type || ''} ${message.value.title || ''} ${message.value.summary || ''}`
  if (message.value.type === 'rule_update' || /规则/.test(text)) {
    // pill 默认灰底灰字，规则通知用中性灰
    return { label: '规则', cls: '' }
  }
  if (/投票/.test(text)) {
    return { label: '投票', cls: 'purple' }
  }
  if (message.value.type === 'order_status' || /兑换|订单/.test(text)) {
    return { label: '兑换审核', cls: 'blue' }
  }
  if (message.value.type === 'task_review' || /任务/.test(text)) {
    return { label: '任务审核', cls: 'amber' }
  }
  if (message.value.type === 'appeal_result' || /申诉/.test(text)) {
    return { label: '申诉结果', cls: 'green' }
  }
  if (message.value.type === 'application_review' || /申请/.test(text)) {
    return { label: '积分申请', cls: 'purple' }
  }
  return { label: '积分变动', cls: 'blue' }
}

/** 摘要按主题分段展示（与申诉页关联卡同一套口径），段内「：」前缀灰化为标签 */
const summarySegments = computed(() => splitMessageSummary(message.value.summary))

function isVote() {
  return typeMeta().label === '投票'
}

function canAppeal() {
  // 申诉结果本身不可再诉
  if (message.value.type === 'appeal_result') return false
  return /驳回|扣分|申诉/.test(`${message.value.title}${message.value.summary}`)
}

/** 申诉目标映射（契约 7.1）：消息类型 → targetType + 深链 ID 字段 */
const APPEAL_TARGETS: Record<string, { key: 'applicationId' | 'orderId' | 'claimId' | 'pointRecordId'; targetType: string }> = {
  application_review: { key: 'applicationId', targetType: 'point_application' },
  order_status: { key: 'orderId', targetType: 'order' },
  task_review: { key: 'claimId', targetType: 'task_claim' },
  point_changed: { key: 'pointRecordId', targetType: 'point_record' }
}

function appealTarget() {
  const meta = APPEAL_TARGETS[message.value.type]
  const targetId = meta ? message.value[meta.key] : 0
  return meta && targetId ? { targetType: meta.targetType, targetId } : null
}

function goAppeal() {
  const target = appealTarget()
  if (target) {
    // 直达申诉表单：预填目标 + 消息摘要作关联事项说明
    const query = [
      `targetType=${target.targetType}`,
      `targetId=${target.targetId}`,
      `remark=${encodeURIComponent(message.value.summary || message.value.title || '')}`,
      `time=${encodeURIComponent(message.value.createdAt || '')}`
    ].join('&')
    uni.navigateTo({ url: `/pages/appeal/index?${query}` })
    return
  }
  // ID 未带出时的降级：去能一键发起申诉的页面（被驳回的申请/订单没有积分流水，去明细是死路）
  if (message.value.type === 'application_review') {
    uni.navigateTo({ url: '/pages/apply/index?view=mine' })
  } else if (message.value.type === 'order_status') {
    uni.navigateTo({ url: '/pages/orders/index' })
  } else if (message.value.type === 'task_review') {
    uni.setStorageSync('tasks:pendingScope', 'mine')
    uni.switchTab({ url: '/pages/tasks/index' })
  } else {
    uni.switchTab({ url: '/pages/points/index' })
  }
}

function appealTip() {
  if (appealTarget()) return '点击上方按钮，可直接对这条记录发起申诉。'
  const tips: Record<string, string> = {
    application_review: '请在「我的申请」中找到该申请，点「申诉」发起。',
    order_status: '请在「我的订单」中找到该订单，点「申诉」发起。',
    task_review: '已为你切到「我的」任务标签，对被驳回的任务点「申诉」发起。'
  }
  return tips[message.value.type] || '申诉需绑定本人积分流水，请在积分明细中选择对应记录后发起。'
}

function openVotes() {
  uni.navigateTo({ url: '/pages/votes/index' })
}

function isRule() {
  return message.value.type === 'rule_update'
}

function openRules() {
  uni.navigateTo({ url: '/pages/rules/index' })
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
      <view class="body">
        <view v-for="seg in summarySegments" :key="seg" class="body-line">
          <text v-if="seg.includes('：')" class="body-key">{{ seg.slice(0, seg.indexOf('：') + 1) }}</text>
          <text>{{ seg.includes('：') ? seg.slice(seg.indexOf('：') + 1) : seg }}</text>
        </view>
      </view>
    </view>

    <view v-if="canAppeal()" class="notice-amber">
      <AppIcon name="lightbulb" :size="32" color="amber" />
      <text>如对审核结果有异议，可在 7 日内发起申诉。</text>
    </view>

    <view v-if="canAppeal()" class="button" @tap="goAppeal">发起申诉</view>
    <text v-if="canAppeal()" class="muted tip">{{ appealTip() }}</text>

    <view v-if="isVote()" class="button ghost" @tap="openVotes">查看投票</view>
    <view v-if="isRule()" class="button ghost" @tap="openRules">查看规则</view>

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

/* 摘要逐主题分行，「标签：」灰化、内容正常色（完整展示不截断） */
.body-line {
  display: block;
}

.body-key {
  color: var(--muted);
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
