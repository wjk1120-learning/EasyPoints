<script setup>
import { nextTick, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '../../api'
import { createAiAgent } from '../../ai/agent.js'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'

const AI_AVATAR = '/static/xiaoyi-avatar.png'
const USER_AVATAR_KEY = 'chatUserAvatar'

const input = ref('')
const sending = ref(false)
const scrollIntoView = ref('msg-0')
const userAvatar = ref('')
const employeeName = ref('')
// 会话（消息历史、开场白、多轮 history 请求）收口在 ai/agent.js，页面只负责渲染与交互
const agent = createAiAgent()
const messages = ref(agent.getMessages())

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
  input.value = ''
  sending.value = true
  await agent.ask(question, {
    onHistoryChange(next) {
      messages.value = next
      scrollToBottom()
    }
  })
  sending.value = false
  await scrollToBottom()
}

function useQuickQuestion(text) {
  input.value = text
  sendQuestion()
}
</script>

<template>
  <view class="ai-page">
    <NavBar title="AI 小易" />

    <scroll-view scroll-y class="chat-list" :scroll-into-view="scrollIntoView" scroll-with-animation>
      <view class="chat-inner">
        <view
          v-for="(item, index) in messages"
          :key="index"
          :id="'msg-' + index"
          class="chat-item"
          :class="item.role"
        >
          <view v-if="item.role === 'assistant'" class="chat-avatar ai-avatar">
            <image class="chat-avatar-img" :src="AI_AVATAR" mode="aspectFill" />
          </view>
          <view class="chat-body">
            <text class="chat-name">{{ item.role === 'assistant' ? 'AI 小易' : (employeeName || '我') }}</text>
            <text class="chat-bubble">{{ item.content }}</text>
          </view>
          <view v-if="item.role === 'user'" class="chat-avatar user-avatar" @tap="onUserAvatarTap">
            <image v-if="userAvatar" class="chat-avatar-img" :src="userAvatar" mode="aspectFill" />
            <text v-else class="chat-avatar-text">{{ userInitial() }}</text>
          </view>
        </view>
        <view v-if="sending" id="msg-loading" class="chat-item assistant">
          <view class="chat-avatar ai-avatar">
            <image class="chat-avatar-img" :src="AI_AVATAR" mode="aspectFill" />
          </view>
          <view class="chat-body">
            <text class="chat-name">AI 小易</text>
            <text class="chat-bubble chat-bubble-typing">正在分析你的积分数据…</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="quick-row">
      <text class="quick-chip" @tap="useQuickQuestion('这个月一共加了多少分？')">本月加分</text>
      <text class="quick-chip" @tap="useQuickQuestion('主要扣在什么地方？')">扣分原因</text>
      <text class="quick-chip" @tap="useQuickQuestion('当前积分余额是多少？')">当前余额</text>
    </view>

    <view class="input-bar">
      <view class="input-avatar" @tap="onUserAvatarTap">
        <image v-if="userAvatar" class="chat-avatar-img" :src="userAvatar" mode="aspectFill" />
        <text v-else class="chat-avatar-text">{{ userInitial() }}</text>
      </view>
      <input
        v-model="input"
        class="chat-input"
        placeholder="向 AI 小易提问…"
        confirm-type="send"
        @confirm="sendQuestion"
      />
      <view class="send-btn" :class="{ disabled: sending }" @tap="sendQuestion">
        <AppIcon name="chevron-right" :size="32" color="white" />
      </view>
    </view>

    <AppTabBar />
  </view>
</template>

<style scoped>
/* 整页锁定为一屏：聊天区内部滚动，输入条固定在底栏上方，不再随页面上下移动 */
.ai-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  padding: calc(var(--status-bar-height) + 130rpx) 24rpx calc(140rpx + env(safe-area-inset-bottom));
}

/* ── 聊天记录 ── */
.chat-list {
  flex: 1;
  min-height: 0;
}

.chat-inner {
  padding: 8rpx 4rpx 24rpx;
}

.chat-item {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.chat-item.user {
  justify-content: flex-end;
  padding-left: 64rpx;
}

.chat-item.assistant {
  padding-right: 64rpx;
}

.chat-avatar {
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-avatar {
  background: var(--brand-soft);
}

.user-avatar {
  background: var(--ink);
}

.chat-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.chat-avatar-text {
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
}

.chat-body {
  max-width: 480rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.chat-item.user .chat-body {
  align-items: flex-end;
}

.chat-name {
  font-size: 20rpx;
  color: var(--muted);
  padding: 0 8rpx;
}

.chat-bubble {
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-item.assistant .chat-bubble {
  background: var(--green-soft);
  color: var(--ink);
  border-top-left-radius: 6rpx;
}

.chat-item.user .chat-bubble {
  background: var(--brand-soft);
  color: var(--ink);
  border-top-right-radius: 6rpx;
}

.chat-bubble-typing {
  color: var(--muted);
}

/* ── 快捷提问 ── */
.quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 8rpx 0 16rpx;
}

.quick-chip {
  padding: 12rpx 26rpx;
  border-radius: var(--r-full);
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 24rpx;
  font-weight: 500;
}

.quick-chip:active {
  opacity: 0.8;
}

/* ── 输入条：flex 布局的最后一个元素，固定在底栏上方 ── */
.input-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 16rpx;
  border-radius: 24rpx;
  background: var(--surface);
  border: 1rpx solid var(--line);
  box-shadow: var(--shadow-card);
}

.input-avatar {
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  overflow: hidden;
  background: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: var(--r-full);
  background: var(--field);
  font-size: 28rpx;
  color: var(--ink);
}

.send-btn {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: var(--brand);
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-btn.disabled {
  opacity: 0.5;
}
</style>
