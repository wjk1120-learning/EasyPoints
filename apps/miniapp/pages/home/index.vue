<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getApiBase, getCachedData, isNetworkError, loginEmployee, request } from '../../api'
import AiFloatBall from '../../components/AiFloatBall.vue'

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
const offlineMode = ref(false)
const debugEnabled = ref(false)
let debugTapCount = 0
let debugTapTimer = null

onShow(async () => {
  const storedApiBase = uni.getStorageSync("apiBase");
  if (storedApiBase === false || storedApiBase === true || String(storedApiBase || "").trim() === "false") {
    uni.removeStorageSync("apiBase");
  }
  apiBase.value = getApiBase();
  wecomUserId.value = uni.getStorageSync("wecomUserId") || "zhangsan";
  authError.value = uni.getStorageSync('employeeAuthError') || ''
  debugEnabled.value = uni.getStorageSync('enableDebug') === '1'
  if (debugEnabled.value) {
    showSettings.value = true
  }
  try {
    if (!uni.getStorageSync('employeeToken')) {
      try {
        await loginEmployee({ wecomUserId: wecomUserId.value })
      } catch (loginError) {
        const cached = getCachedData('/miniapp/home')
        if (cached && isNetworkError(loginError)) {
          applyHomeData(cached, true)
          await refreshHallBadge()
          return
        }
        throw loginError
      }
    }
    const data = await request('/miniapp/home')
    applyHomeData(data, Boolean(data?.__offline))
    await refreshHallBadge()
  } catch (error) {
    const cached = getCachedData('/miniapp/home')
    if (cached && isNetworkError(error)) {
      applyHomeData(cached, true)
      return
    }
    offlineMode.value = false
    const reason = uni.getStorageSync('employeeAuthError') || ''
    if (reason === 'network_error' && uni.getStorageSync('employeeToken')) {
      authError.value = '网络不可用，请检查 API 地址与网络连接'
    } else {
      authError.value = error?.message || reason || '加载失败'
    }
    uni.showToast({ title: authError.value || '加载失败', icon: 'none' })
  }
})

function applyHomeData(data, offline) {
  home.value = stripOfflineFlag(data)
  offlineMode.value = offline
  if (offline) {
    authError.value = ''
  } else {
    uni.removeStorageSync('employeeAuthError')
    authError.value = ''
  }
}

function stripOfflineFlag(data) {
  if (!data || typeof data !== 'object') return data
  const next = { ...data }
  delete next.__offline
  return next
}

function saveSettings() {
  const nextApiBase = normalizeApiBaseInput(apiBase.value);
  apiBase.value = nextApiBase || getApiBase();
  if (nextApiBase) {
    uni.setStorageSync("apiBase", nextApiBase);
  } else {
    uni.removeStorageSync("apiBase");
  }
  uni.setStorageSync("wecomUserId", String(wecomUserId.value || "").trim() || "zhangsan");
  uni.showToast({ title: "设置已保存" });
}

function normalizeApiBaseInput(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "false" || raw === "true") return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function relogin() {
  saveSettings();
  try {
    await loginEmployee({ wecomUserId: wecomUserId.value });
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
    try { uni.removeTabBarBadge({ index: 1 }) } catch {}
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
  <view class="page page-tab">
    <view class="card card-hero hero">
      <text class="section-label">欢迎回来</text>
      <text class="hero-name">{{ home.employee.name || '员工' }}</text>
      <text class="balance">{{ home.pointsBalance }}</text>
      <text class="muted">当前可用积分</text>
    </view>

    <view v-if="offlineMode" class="card offline-banner">
      <text class="offline-title">离线模式</text>
      <text class="muted">已展示上次成功加载的数据，恢复网络后将自动更新</text>
    </view>

    <view v-if="authError && !offlineMode" class="card card-warning warning">
      <text class="warning-title">登录状态异常</text>
      <text class="muted">{{ authError }}</text>
      <view class="small-button" style="margin-top: 20rpx" @tap="relogin">重新登录</view>
    </view>

    <view class="grid-2">
      <view class="card stat-card">
        <text class="muted">本月变动</text>
        <text class="stat-num" :class="home.monthDelta >= 0 ? 'pos' : 'neg'">
          {{ home.monthDelta >= 0 ? '+' : '' }}{{ home.monthDelta }}
        </text>
      </view>
      <view class="card stat-card clickable" @tap="openMessages">
        <text class="muted">通知提醒</text>
        <text class="stat-num">{{ home.unreadMessages }}</text>
        <view v-if="home.unreadMessages > 0" class="corner-badge">{{ formatBadge(home.unreadMessages) }}</view>
      </view>
    </view>

    <view class="button" @tap="uni.switchTab({ url: '/pages/points/index' })">查看积分明细</view>
    <view class="button ghost" style="margin-top: 16rpx" @tap="uni.navigateTo({ url: '/pages/orders/index' })">我的订单</view>

    <view class="settings-toggle muted" @tap="toggleSettings">
      {{ showSettings ? '收起设置' : '展开设置' }}
    </view>

    <view v-if="showSettings" class="card settings-card">
      <text class="muted">API_BASE</text>
      <input v-model="apiBase" class="input" placeholder="真机调试请填电脑局域网IP，例如：http://192.168.x.x:3000" />
      <view class="small-button ghost" style="margin-top: 16rpx" @tap="apiBase = getApiBase()">使用默认 API 地址</view>
      <text class="muted" style="margin-top: 20rpx; display: block">wecomUserId</text>
      <input v-model="wecomUserId" class="input" placeholder="例如：zhangsan 或 lisi" />
      <text class="muted" style="margin-top: 12rpx; display: block">切换账号：改成 lisi 后点「保存并登录」</text>
      <view class="settings-actions">
        <view class="small-button" @tap="saveSettings">保存</view>
        <view class="small-button ghost" @tap="relogin">保存并登录</view>
      </view>
    </view>
    <AiFloatBall />
  </view>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.hero-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #3a7ca5;
}

.balance {
  font-size: 80rpx;
  font-weight: 700;
  letter-spacing: -2rpx;
  color: #3a7ca5;
  margin: 4rpx 0;
}

.stat-card {
  position: relative;
  padding: 28rpx;
}

.stat-num {
  display: block;
  margin-top: 12rpx;
  font-size: 40rpx;
  font-weight: 700;
  color: #1c1c1e;
}

.clickable:active {
  opacity: 0.92;
  transform: scale(0.985);
}

.warning-title {
  display: block;
  font-weight: 600;
  font-size: 30rpx;
  color: #b45309;
  margin-bottom: 8rpx;
}

.offline-banner {
  background: rgba(232, 244, 252, 0.85);
  border: 1rpx solid rgba(91, 155, 213, 0.25);
}

.offline-title {
  display: block;
  font-weight: 600;
  font-size: 28rpx;
  color: #3a7ca5;
  margin-bottom: 8rpx;
}

.settings-toggle {
  text-align: center;
  padding: 20rpx 0 8rpx;
}

.settings-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}
</style>
