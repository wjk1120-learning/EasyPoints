<script setup>
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { getApiBase, getCachedData, isNetworkError, loginEmployee, request } from '../../api'
import AiFloatBall from '../../components/AiFloatBall.vue'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'

const home = ref({ pointsBalance: 0, monthDelta: 0, unreadMessages: 0, employee: {} })
const recent = ref([])
const pendingVotes = ref(0)
const showSettings = ref(false)
const apiBase = ref('')
const wecomUserId = ref('')
const authError = ref('')
const offlineMode = ref(false)
const debugEnabled = ref(false)
let debugTapCount = 0
let debugTapTimer = null

const availablePoints = computed(() => Number(home.value.pointsBalance || 0))
const actualPoints = computed(() => {
  const value = home.value.actualPoints ?? home.value.honorPoints
  return value == null || value === '' ? null : Number(value)
})

const shortcuts = [
  { label: '任务大厅', icon: '📋', tile: 'green', action: () => uni.switchTab({ url: '/pages/tasks/index' }) },
  { label: '积分排名', icon: '🏆', tile: 'amber', action: () => uni.navigateTo({ url: '/pages/leaderboard/index' }) },
  { label: '积分申请', icon: '📝', tile: 'purple', action: () => uni.navigateTo({ url: '/pages/apply/index' }) },
  { label: '规则中心', icon: '📖', tile: 'blue', action: () => uni.navigateTo({ url: '/pages/rules/index' }) },
  { label: '通知中心', icon: '🔔', tile: 'red', badge: 'messages', action: () => uni.navigateTo({ url: '/pages/messages/index' }) },
  { label: '我的投票', icon: '🗳️', tile: 'purple', badge: 'votes', action: () => uni.navigateTo({ url: '/pages/votes/index' }) }
]

onShow(async () => {
  const storedApiBase = uni.getStorageSync('apiBase')
  if (storedApiBase === false || storedApiBase === true || String(storedApiBase || '').trim() === 'false') {
    uni.removeStorageSync('apiBase')
  }
  apiBase.value = getApiBase()
  wecomUserId.value = uni.getStorageSync('wecomUserId') || 'zhangsan'
  authError.value = uni.getStorageSync('employeeAuthError') || ''
  debugEnabled.value = uni.getStorageSync('enableDebug') === '1'
  if (debugEnabled.value) showSettings.value = true
  try {
    if (!uni.getStorageSync('employeeToken')) {
      await loginEmployee({ wecomUserId: wecomUserId.value })
    }
    const data = await request('/miniapp/home')
    applyHomeData(data, Boolean(data?.__offline))
    await loadRecent()
    loadPendingVotes()
  } catch (error) {
    const cached = getCachedData('/miniapp/home')
    if (cached && isNetworkError(error)) {
      applyHomeData(cached, true)
      return
    }
    offlineMode.value = false
    authError.value = error?.message || '加载失败'
    uni.showToast({ title: authError.value, icon: 'none' })
  }
})

onPullDownRefresh(async () => {
  try {
    const data = await request('/miniapp/home')
    applyHomeData(data, Boolean(data?.__offline))
    await loadRecent()
    loadPendingVotes()
  } catch {} finally {
    uni.stopPullDownRefresh()
  }
})

async function loadPendingVotes() {
  try {
    const votes = await request('/miniapp/votes?scope=pending')
    const rows = Array.isArray(votes) ? votes : []
    pendingVotes.value = rows.filter((vote) => !vote.submitted).length
  } catch {
    pendingVotes.value = 0
  }
}

function badgeCount(item) {
  if (item.badge === 'messages') return Number(home.value.unreadMessages || 0)
  if (item.badge === 'votes') return pendingVotes.value
  return 0
}

function applyHomeData(data, offline) {
  const next = { ...(data || {}) }
  delete next.__offline
  home.value = next
  offlineMode.value = offline
  if (!offline) uni.removeStorageSync('employeeAuthError')
}

async function loadRecent() {
  try {
    const groups = await request('/miniapp/points/records')
    const rows = []
    Object.keys(groups || {}).forEach((month) => {
      ;(groups[month] || []).forEach((record) => rows.push(record))
    })
    rows.sort((a, b) => String(b.occurredAt || b.createdAt || '').localeCompare(String(a.occurredAt || a.createdAt || '')))
    recent.value = rows.slice(0, 3)
  } catch {
    recent.value = []
  }
}

function recordIcon(record) {
  const text = `${record.type || ''} ${record.sourceType || ''}`
  if (/exchange|order|mall/.test(text)) return { emoji: '🛍️', tile: 'red' }
  if (/penalty|deduct/.test(text)) return { emoji: '⚠️', tile: 'red' }
  if (/reward|manual|bonus/.test(text)) return { emoji: '🎁', tile: 'green' }
  return Number(record.pointsDelta) > 0 ? { emoji: '📈', tile: 'green' } : { emoji: '📉', tile: 'red' }
}

function saveSettings() {
  const nextApiBase = normalizeApiBaseInput(apiBase.value)
  apiBase.value = nextApiBase || getApiBase()
  if (nextApiBase) uni.setStorageSync('apiBase', nextApiBase)
  else uni.removeStorageSync('apiBase')
  uni.setStorageSync('wecomUserId', String(wecomUserId.value || '').trim() || 'zhangsan')
  uni.showToast({ title: '设置已保存' })
}

function normalizeApiBaseInput(value) {
  const raw = String(value || '').trim()
  if (!raw || raw === 'false' || raw === 'true') return ''
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

async function relogin() {
  saveSettings()
  try {
    await loginEmployee({ wecomUserId: wecomUserId.value })
    authError.value = ''
    home.value = await request('/miniapp/home')
    await loadRecent()
    uni.showToast({ title: '登录成功' })
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
  debugTapTimer = setTimeout(() => { debugTapCount = 0 }, 1200)
  if (debugTapCount >= 7) {
    uni.setStorageSync('enableDebug', '1')
    debugEnabled.value = true
    showSettings.value = true
    debugTapCount = 0
    uni.showToast({ title: '调试设置已开启', icon: 'none' })
  }
}

function formatPoints(value) {
  const num = Number(value || 0)
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function friendlyTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16)
  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  if (diffDays === 0) return `今天 ${hh}:${mm}`
  if (diffDays === 1) return `昨天 ${hh}:${mm}`
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${m}-${d} ${hh}:${mm}`
}
</script>

<template>
  <view class="page page-tab page-nav">
    <NavBar title="首页" :back="false" />

    <view class="hero card-hero">
      <view class="hero-top">
        <view class="hero-who">
          <text class="hero-name">{{ home.employee?.name || '员工' }}</text>
          <text class="hero-dept">{{ home.employee?.departmentName || '未分配部门' }}</text>
        </view>
        <text class="hero-badge">在职</text>
      </view>
      <view class="hero-scores">
        <view class="hero-score">
          <text class="hero-label">实时积分</text>
          <text class="hero-num">{{ formatPoints(availablePoints) }}</text>
        </view>
        <view class="hero-score">
          <text class="hero-label">实际积分</text>
          <text class="hero-num">{{ actualPoints == null ? '—' : formatPoints(actualPoints) }}</text>
        </view>
      </view>
      <text v-if="actualPoints == null" class="hero-note">实际积分字段待后端提供，当前展示「—」</text>
    </view>

    <view v-if="offlineMode" class="card"><text class="muted">离线模式，展示上次成功数据</text></view>
    <view v-if="authError && !offlineMode" class="card">
      <text class="muted">{{ authError }}</text>
      <view class="button" style="margin-top: 16rpx" @tap="relogin">重新登录</view>
    </view>

    <view class="card">
      <view class="block-title">快捷入口</view>
      <view class="shortcut-grid">
        <view v-for="item in shortcuts" :key="item.label" class="shortcut" @tap="item.action()">
          <view class="shortcut-icon-wrap">
            <view class="icon-tile shortcut-icon" :class="item.tile">{{ item.icon }}</view>
            <text v-if="badgeCount(item) > 0" class="shortcut-badge">{{ badgeCount(item) > 99 ? '99+' : badgeCount(item) }}</text>
          </view>
          <text class="shortcut-label">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="row between block-title-row">
        <text class="block-title">最近积分变动</text>
        <text class="link" @tap="uni.switchTab({ url: '/pages/points/index' })">查看全部</text>
      </view>
      <view v-if="recent.length === 0" class="recent-empty"><text class="muted">暂无积分流水</text></view>
      <view v-for="record in recent" :key="record.id" class="record-row recent-row">
        <view class="icon-tile recent-icon" :class="recordIcon(record).tile">{{ recordIcon(record).emoji }}</view>
        <view class="recent-main">
          <text class="recent-title">{{ record.remark }}</text>
          <text class="muted">{{ friendlyTime(record.occurredAt || record.createdAt) }}</text>
        </view>
        <text class="recent-amount" :class="record.pointsDelta > 0 ? 'pos' : 'neg'">
          {{ record.pointsDelta > 0 ? '+' : '' }}{{ formatPoints(record.pointsDelta) }}
        </text>
      </view>
    </view>

    <view class="settings-toggle muted" @tap="toggleSettings">{{ showSettings ? '收起设置' : '展开设置' }}</view>
    <view v-if="showSettings" class="card">
      <text class="muted">API_BASE</text>
      <input v-model="apiBase" class="input" placeholder="http://192.168.x.x:3000" />
      <text class="muted">wecomUserId</text>
      <input v-model="wecomUserId" class="input" placeholder="zhangsan" />
      <view class="row" style="gap: 16rpx; margin-top: 16rpx">
        <view class="button" style="flex: 1" @tap="saveSettings">保存</view>
        <view class="button ghost" style="flex: 1" @tap="relogin">保存并登录</view>
      </view>
    </view>
    <AiFloatBall />
    <AppTabBar />
  </view>
</template>

<style scoped>
.hero {
  /* 与 .card 的 margin-bottom 对齐：信息卡→快捷入口、快捷入口→最近变动 间距一致 */
  margin-bottom: 20rpx;
  padding: 36rpx 32rpx;
  border-radius: 24rpx;
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.hero-who {
  flex: 1;
  min-width: 0;
}

.hero-name {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
}

.hero-dept {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  opacity: 0.82;
}

.hero-badge {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.22);
}

.hero-scores {
  display: flex;
  gap: 96rpx;
  margin-top: 36rpx;
}

.hero-score {
  display: flex;
  flex-direction: column;
}

.hero-label {
  font-size: 22rpx;
  opacity: 0.78;
}

.hero-num {
  margin-top: 8rpx;
  font-size: 48rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.hero-note {
  display: block;
  margin-top: 16rpx;
  font-size: 20rpx;
  opacity: 0.75;
}

.block-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a2233;
}

.block-title-row {
  margin-bottom: 8rpx;
}

.shortcut-grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8rpx;
}

.shortcut {
  width: 33.33%;
  margin-top: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.shortcut:active {
  opacity: 0.7;
}

.shortcut-icon-wrap {
  position: relative;
}

.shortcut-icon {
  width: 88rpx;
  height: 88rpx;
  font-size: 40rpx;
}

.shortcut-badge {
  position: absolute;
  top: -10rpx;
  right: -14rpx;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: #f04438;
  color: #fff;
  font-size: 18rpx;
  font-weight: 600;
  text-align: center;
  box-sizing: border-box;
}

.shortcut-label {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #4e5561;
}

.recent-empty {
  padding: 24rpx 0 8rpx;
  text-align: center;
}

.recent-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.recent-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  font-size: 32rpx;
}

.recent-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.recent-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a2233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-amount {
  flex-shrink: 0;
  font-size: 32rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.settings-toggle {
  text-align: center;
  padding: 16rpx 0;
}
</style>
