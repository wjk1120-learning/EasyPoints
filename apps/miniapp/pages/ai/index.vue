<script setup>
import { nextTick, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { askAi, request } from '../../api'

const AI_AVATAR = '/static/ai-avatar.png'
const USER_AVATAR_KEY = 'chatUserAvatar'

const input = ref('')
const sending = ref(false)
const scrollIntoView = ref('msg-0')
const userAvatar = ref('')
const employeeName = ref('')
const messages = ref([
  {
    role: 'assistant',
    content: '你好，我是积分 AI 助手。可以问我积分变动、扣分原因，或「我现在能兑换什么奖品？」等问题。'
  }
])

onShow(async () => {
  userAvatar.value = uni.getStorageSync(USER_AVATAR_KEY) || ''
  try {
    const home = await request('/miniapp/home')
    employeeName.value = home?.employee?.name || ''
  } catch {
    employeeName.value = ''
  }
  await scrollToBottom()
})

function userInitial() {
  const name = String(employeeName.value || '').trim()
  return name ? name.slice(0, 1) : '我'
}

async function scrollToBottom() {
  await nextTick()
  scrollIntoView.value = `msg-${messages.value.length - 1}`
}

function chooseUserAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success(res) {
      const tempPath = res.tempFilePaths?.[0]
      if (!tempPath) return
      uni.saveFile({
        tempFilePath: tempPath,
        success(saveRes) {
          userAvatar.value = saveRes.savedFilePath
          uni.setStorageSync(USER_AVATAR_KEY, saveRes.savedFilePath)
          uni.showToast({ title: '头像已更新', icon: 'success' })
        },
        fail() {
          userAvatar.value = tempPath
          uni.setStorageSync(USER_AVATAR_KEY, tempPath)
          uni.showToast({ title: '头像已更新', icon: 'success' })
        }
      })
    }
  })
}

function resetUserAvatar() {
  userAvatar.value = ''
  uni.removeStorageSync(USER_AVATAR_KEY)
  uni.showToast({ title: '已恢复默认头像', icon: 'none' })
}

function onUserAvatarTap() {
  uni.showActionSheet({
    itemList: ['更换头像', '恢复默认'],
    success(res) {
      if (res.tapIndex === 0) chooseUserAvatar()
      if (res.tapIndex === 1) resetUserAvatar()
    }
  })
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
    if (result.notice) {
      messages.value.push({ role: 'assistant', content: result.notice })
    }
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
    <view class="hero card card-hero">
      <view class="hero-top">
        <view class="hero-avatars">
          <view class="hero-avatar-wrap">
            <view class="avatar-circle hero-size ai-style">
              <image class="avatar-img" :src="AI_AVATAR" mode="aspectFill" />
            </view>
            <text class="hero-avatar-label">AI 助手</text>
          </view>
          <view class="hero-avatar-wrap" @tap="onUserAvatarTap">
            <view class="avatar-circle hero-size user-style">
              <image v-if="userAvatar" class="avatar-img" :src="userAvatar" mode="aspectFill" />
              <text v-else class="avatar-initial">{{ userInitial() }}</text>
            </view>
            <text class="hero-avatar-label">{{ employeeName || '我' }}</text>
          </view>
        </view>
        <view class="hero-text">
          <text class="hero-title">积分 AI 助手</text>
          <text class="hero-sub">仅回答当前登录员工的积分问题</text>
          <text class="hero-tip">点击右侧头像可更换</text>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="chat-list card" :scroll-into-view="scrollIntoView" scroll-with-animation>
      <view class="chat-list-inner">
      <view
        v-for="(item, index) in messages"
        :key="index"
        :id="'msg-' + index"
        class="chat-item"
        :class="item.role"
      >
        <view v-if="item.role === 'assistant'" class="avatar-circle chat-size ai-style">
          <image class="avatar-img" :src="AI_AVATAR" mode="aspectFill" />
        </view>
        <view class="chat-body">
          <text class="chat-name">{{ item.role === 'assistant' ? '积分 AI' : (employeeName || '我') }}</text>
          <text class="chat-bubble">{{ item.content }}</text>
        </view>
        <view
          v-if="item.role === 'user'"
          class="avatar-circle chat-size user-style"
          @tap="onUserAvatarTap"
        >
          <image v-if="userAvatar" class="avatar-img" :src="userAvatar" mode="aspectFill" />
          <text v-else class="avatar-initial">{{ userInitial() }}</text>
        </view>
      </view>
      <view v-if="sending" id="msg-loading" class="chat-item assistant">
        <view class="avatar-circle chat-size ai-style">
          <image class="avatar-img" :src="AI_AVATAR" mode="aspectFill" />
        </view>
        <view class="chat-body">
          <text class="chat-name">积分 AI</text>
          <text class="chat-bubble muted-bubble">正在分析你的积分数据...</text>
        </view>
      </view>
      </view>
    </scroll-view>

    <view class="quick-row">
      <text class="quick-chip" @tap="useQuickQuestion('这个月一共加了多少分？')">本月加分</text>
      <text class="quick-chip" @tap="useQuickQuestion('主要扣在什么地方？')">扣分原因</text>
      <text class="quick-chip" @tap="useQuickQuestion('当前积分余额是多少？')">当前余额</text>
    </view>

    <view class="input-row">
      <view class="avatar-circle chat-size user-style input-avatar" @tap="onUserAvatarTap">
        <image v-if="userAvatar" class="avatar-img" :src="userAvatar" mode="aspectFill" />
        <text v-else class="avatar-initial">{{ userInitial() }}</text>
      </view>
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
  box-sizing: border-box;
}
.hero-top {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.hero-avatars {
  display: flex;
  gap: 16rpx;
  flex-shrink: 0;
}

.hero-avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.hero-avatar-label {
  font-size: 20rpx;
  color: #8e8e93;
  max-width: 96rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #3a7ca5;
}

.hero-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8e8e93;
}

.hero-tip {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #aeaeb2;
}

.chat-list {
  flex: 1;
  min-height: 420rpx;
  max-height: calc(100vh - 480rpx);
  margin-bottom: 16rpx;
  padding: 0;
  box-sizing: border-box;
}

.chat-list-inner {
  padding: 24rpx 20rpx 8rpx;
  box-sizing: border-box;
}

.chat-item {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.chat-item.user {
  justify-content: flex-end;
  padding-left: 48rpx;
}

.chat-item.assistant {
  padding-right: 48rpx;
}

.avatar-circle {
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.avatar-circle.hero-size {
  width: 80rpx;
  height: 80rpx;
}

.avatar-circle.chat-size {
  width: 72rpx;
  height: 72rpx;
}

.avatar-circle.ai-style {
  background: rgba(255, 255, 255, 0.75);
  border: 2rpx solid rgba(168, 216, 234, 0.6);
  box-shadow: 0 4rpx 12rpx rgba(91, 155, 213, 0.1);
}

.avatar-circle.user-style {
  background: linear-gradient(135deg, #6bcb9a, #5b9bd5);
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 4rpx 12rpx rgba(91, 155, 213, 0.15);
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.avatar-initial {
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
}

.avatar-circle.hero-size .avatar-initial {
  font-size: 32rpx;
}

.chat-body {
  max-width: 520rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.chat-item.user .chat-body {
  align-items: flex-end;
}

.chat-name {
  font-size: 22rpx;
  color: #aeaeb2;
  padding: 0 8rpx;
}

.chat-bubble {
  max-width: 100%;
  padding: 20rpx 24rpx;
  border-radius: 22rpx;
  font-size: 28rpx;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-item.user .chat-bubble {
  background: linear-gradient(135deg, #6bcb9a, #5b9bd5);
  color: #fff;
  border-top-right-radius: 6rpx;
  box-shadow: 0 4rpx 16rpx rgba(91, 155, 213, 0.2);
}

.chat-item.assistant .chat-bubble {
  background: rgba(255, 255, 255, 0.72);
  color: #1c1c1e;
  border: 1rpx solid rgba(168, 216, 234, 0.35);
  border-top-left-radius: 6rpx;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.muted-bubble {
  color: #8e8e93;
}

.quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.quick-chip {
  padding: 12rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.55);
  color: #3a7ca5;
  font-size: 24rpx;
  font-weight: 500;
  border: 1rpx solid rgba(91, 155, 213, 0.18);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.input-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
  padding: 12rpx 16rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.55);
  border: 1rpx solid rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 4rpx 20rpx rgba(91, 155, 213, 0.08);
}

.input-avatar {
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  background: transparent;
  border: none;
  font-size: 28rpx;
}

.send-btn {
  min-width: 112rpx;
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #6bcb9a, #5b9bd5);
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
  box-shadow: 0 4rpx 12rpx rgba(91, 155, 213, 0.22);
}

.send-btn.disabled {
  opacity: 0.5;
}
</style>
