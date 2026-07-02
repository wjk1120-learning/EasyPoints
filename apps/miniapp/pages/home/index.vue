<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getApiBase, loginEmployee, request } from '../../api'

const home = ref({
  pointsBalance: 0,
  monthDelta: 0,
  unreadMessages: 0,
  employee: {}
})
const showSettings = ref(false)
const apiBase = ref('')
const wecomUserId = ref('')
const authError = ref('')
const debugEnabled = ref(false)
let debugTapCount = 0
let debugTapTimer = null

onShow(async () => {
  apiBase.value = getApiBase()
  wecomUserId.value = uni.getStorageSync('wecomUserId') || 'zhangsan'
  authError.value = uni.getStorageSync('employeeAuthError') || ''
  debugEnabled.value = uni.getStorageSync('enableDebug') === '1'
  try {
    home.value = await request('/miniapp/home')
    await refreshHallBadge()
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  }
})

function saveSettings() {
  apiBase.value = String(apiBase.value || '').trim()
  uni.setStorageSync('apiBase', apiBase.value)
  uni.setStorageSync('wecomUserId', wecomUserId.value)
  uni.showToast({ title: '设置已保存' })
}

async function relogin() {
  try {
    await loginEmployee({ wecomUserId: wecomUserId.value })
    uni.removeStorageSync('employeeAuthError')
    authError.value = ''
    uni.showToast({ title: '登录成功' })
    home.value = await request('/miniapp/home')
  } catch (error) {
    uni.showToast({ title: error?.message || '登录失败', icon: 'none' })
  }
}

function toggleSettings() {
  if (debugEnabled.value) {
    showSettings.value = !showSettings.value
    return
  }
  debugTapCount += 1
  if (debugTapTimer) clearTimeout(debugTapTimer)
  debugTapTimer = setTimeout(() => {
    debugTapCount = 0
  }, 1200)
  if (debugTapCount >= 7) {
    uni.setStorageSync('enableDebug', '1')
    debugEnabled.value = true
    showSettings.value = true
    debugTapCount = 0
    uni.showToast({ title: '调试设置已开启', icon: 'none' })
  }
}

function openMessages() {
  uni.navigateTo({ url: '/pages/messages/index' })
}

function formatBadge(count) {
  const n = Number(count || 0)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n > 99) return '99+'
  return String(Math.floor(n))
}

async function refreshHallBadge() {
  const since = uni.getStorageSync('hallSeenAt') || ''
  if (!since) {
    try {
      uni.removeTabBarBadge({ index: 1 })
    } catch {}
    return
  }
  try {
    const result = await request(`/miniapp/hall/unread-count?since=${encodeURIComponent(since)}`)
    const count = Number(result?.count || 0)
    if (count > 0) {
      uni.setTabBarBadge({ index: 1, text: formatBadge(count) })
    } else {
      uni.removeTabBarBadge({ index: 1 })
    }
  } catch {
  }
}
</script>

<template>
  <view class="page">
    <view class="card hero">
      <text class="muted">{{ home.employee.name || '员工' }}</text>
      <text class="balance">{{ home.pointsBalance }}</text>
      <text class="muted">当前可用积分</text>
    </view>

    <view v-if="authError" class="card warning">
      <text class="warning-title">登录状态异常</text>
      <text class="muted">{{ authError }}</text>
      <view class="small-button" @tap="relogin">重新登录</view>
    </view>

    <view class="grid">
      <view class="card">
        <text class="muted">本月变动</text>
        <text class="number">{{ home.monthDelta }}</text>
      </view>
      <view class="card clickable" @tap="openMessages">
        <text class="muted">通知提醒</text>
        <text class="number">{{ home.unreadMessages }}</text>
        <view v-if="home.unreadMessages > 0" class="cornerBadge">{{ formatBadge(home.unreadMessages) }}</view>
      </view>
    </view>
    <view class="button" @tap="uni.switchTab({ url: '/pages/points/index' })">查看积分明细</view>

    <view class="muted" style="margin-top: 18rpx" @tap="toggleSettings">
      {{ showSettings ? '收起设置' : '展开设置' }}
    </view>

    <view v-if="showSettings" class="card">
      <text class="muted">API_BASE</text>
      <input v-model="apiBase" class="input" placeholder="真机调试请填电脑局域网IP，例如：http://192.168.x.x:3000" />
      <view class="small-button ghost" style="margin-top: 12rpx" @tap="apiBase = 'http://192.168.1.105:3000'">使用当前电脑地址</view>
      <text class="muted" style="margin-top: 16rpx; display: block">wecomUserId</text>
      <input v-model="wecomUserId" class="input" placeholder="例如：zhangsan" />
      <view style="display: flex; gap: 18rpx; margin-top: 18rpx">
        <view class="small-button" @tap="saveSettings">保存</view>
        <view class="small-button ghost" @tap="relogin">保存并登录</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.balance {
  font-size: 72rpx;
  font-weight: 700;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.number {
  display: block;
  margin-top: 12rpx;
  font-size: 36rpx;
  font-weight: 700;
}

.clickable {
  position: relative;
}

.clickable:active {
  opacity: 0.9;
  transform: scale(0.99);
}

.cornerBadge {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
  min-width: 44rpx;
  height: 44rpx;
  line-height: 44rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: #ef4444;
  color: #fff;
  font-size: 22rpx;
  text-align: center;
  box-sizing: border-box;
}

.warning {
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.warning-title {
  font-weight: 700;
  margin-bottom: 10rpx;
  display: block;
}

.input {
  width: 100%;
  height: 72rpx;
  padding: 0 18rpx;
  box-sizing: border-box;
  background: #f8fafc;
  border-radius: 8rpx;
  margin-top: 12rpx;
}

.small-button {
  min-width: 140rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: 8rpx;
  background: #1677ff;
  color: #fff;
  text-align: center;
  padding: 0 18rpx;
}

.ghost {
  background: #eef2ff;
  color: #1d4ed8;
}
</style>
