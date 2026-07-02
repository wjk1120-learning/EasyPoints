<script setup>
import { nextTick, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { askAi } from '../../api'

const input = ref('')
const sending = ref(false)
const scrollIntoView = ref('msg-0')
const messages = ref([
  {
    role: 'assistant',
    content: '你好，我是积分 AI 助手。可以问我积分变动、扣分原因，或「我现在能兑换什么奖品？」等问题。'
  }
])

onShow(async () => {
  await scrollToBottom()
})

async function scrollToBottom() {
  await nextTick()
  scrollIntoView.value = `msg-${messages.value.length - 1}`
}

async function sendQuestion() {
  const question = String(input.value || '').trim()
  if (!question || sending.value) return
  messages.value.push({ role: 'user', content: question })
  input.value = ''
  sending.value = true
  await scrollToBottom()
  try {
    const result = await askAi(question)
    messages.value.push({ role: 'assistant', content: result.answer || '暂时无法回答，请稍后再试。' })
  } catch (error) {
    messages.value.push({
      role: 'assistant',
      content: error?.message || '请求失败，请确认已登录且后端服务正常。'
    })
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

function useQuickQuestion(text) {
  input.value = text
  sendQuestion()
}
</script>

<template>
  <view class="page ai-page">
    <view class="hero card">
      <text class="hero-title">积分 AI 助手</text>
      <text class="hero-sub">仅回答当前登录员工的积分问题</text>
    </view>

    <scroll-view scroll-y class="chat-list card" :scroll-into-view="scrollIntoView" scroll-with-animation>
      <view
        v-for="(item, index) in messages"
        :key="index"
        :id="'msg-' + index"
        class="chat-item"
        :class="item.role"
      >
        <text class="chat-bubble">{{ item.content }}</text>
      </view>
      <view v-if="sending" class="chat-item assistant">
        <text class="chat-bubble muted-bubble">正在分析你的积分数据...</text>
      </view>
    </scroll-view>

    <view class="quick-row">
      <text class="quick-chip" @tap="useQuickQuestion('这个月一共加了多少分？')">本月加分</text>
      <text class="quick-chip" @tap="useQuickQuestion('主要扣在什么地方？')">扣分原因</text>
      <text class="quick-chip" @tap="useQuickQuestion('当前积分余额是多少？')">当前余额</text>
    </view>

    <view class="input-row">
      <input
        v-model="input"
        class="chat-input"
        placeholder="输入你的问题..."
        confirm-type="send"
        @confirm="sendQuestion"
      />
      <view class="send-btn" :class="{ disabled: sending }" @tap="sendQuestion">发送</view>
    </view>
  </view>
</template>

<style scoped>
.ai-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.hero {
  padding-top: 20rpx;
  padding-bottom: 20rpx;
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.12), rgba(14, 165, 233, 0.1));
  border: 1px solid rgba(20, 184, 166, 0.18);
}

.hero-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #0f766e;
}

.hero-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #64748b;
}

.chat-list {
  flex: 1;
  min-height: 420rpx;
  max-height: calc(100vh - 420rpx);
  margin-bottom: 16rpx;
}

.chat-item {
  display: flex;
  margin-bottom: 16rpx;
}

.chat-item.user {
  justify-content: flex-end;
}

.chat-item.assistant {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 88%;
  padding: 18rpx 22rpx;
  border-radius: 18rpx;
  font-size: 26rpx;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-item.user .chat-bubble {
  background: linear-gradient(135deg, #14b8a6, #0ea5e9);
  color: #fff;
}

.chat-item.assistant .chat-bubble {
  background: #f0fdfa;
  color: #134e4a;
  border: 1px solid #ccfbf1;
}

.muted-bubble {
  color: #64748b;
}

.quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.quick-chip {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #ecfeff;
  color: #0f766e;
  font-size: 22rpx;
  border: 1px solid #a5f3fc;
}

.input-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.chat-input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 999rpx;
  font-size: 26rpx;
}

.send-btn {
  min-width: 112rpx;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #14b8a6, #0ea5e9);
  color: #fff;
  font-size: 26rpx;
}

.send-btn.disabled {
  opacity: 0.6;
}
</style>
