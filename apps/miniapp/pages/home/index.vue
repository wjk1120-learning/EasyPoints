<script setup>
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { getApiBase, getCachedData, isNetworkError, loginEmployee, request } from '../../api'
import AiFloatBall from '../../components/AiFloatBall.vue'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

const home = ref({ pointsBalance: 0, monthDelta: 0, unreadMessages: 0, employee: {} })
const recent = ref([])
const pendingVotes = ref(0)
const loading = ref(true)
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
const monthDeltaText = computed(() => {
  const delta = Number(home.value.monthDelta || 0)
  return `${delta > 0 ? '+' : ''}${formatPoints(delta)}`
})

const shortcuts = [
  { label: '积分商城', icon: 'shopping-bag', tile: 'blue', tone: 'brand', action: () => uni.switchTab({ url: '/pages/mall/index' }) },
  { label: '积分排名', icon: 'trophy', tile: 'amber', tone: 'amber', action: () => uni.navigateTo({ url: '/pages/leaderboard/index' }) },
  { label: '积分申请', icon: 'file-text', tile: 'purple', tone: 'purple', action: () => uni.navigateTo({ url: '/pages/apply/index' }) },
  { label: '规则中心', icon: 'book-open', tile: 'blue', tone: 'brand', action: () => uni.navigateTo({ url: '/pages/rules/index' }) },
  { label: '通知中心', icon: 'bell', tile: 'red', tone: 'red', badge: 'messages', action: () => uni.navigateTo({ url: '/pages/messages/index' }) },
  { label: '我的投票', icon: 'check-square', tile: 'purple', tone: 'purple', badge: 'votes', action: () => uni.navigateTo({ url: '/pages/votes/index' }) }
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
  } finally {
    loading.value = false
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
  if (/exchange|order|mall/.test(text)) return { icon: 'shopping-bag', tile: 'red', tone: 'red' }
  if (/penalty|deduct/.test(text)) return { icon: 'alert-triangle', tile: 'red', tone: 'red' }
  if (/reward|manual|bonus/.test(text)) return { icon: 'gift', tile: 'green', tone: 'green' }
  return Number(record.pointsDelta) > 0
    ? { icon: 'trending-up', tile: 'green', tone: 'green' }
    : { icon: 'trending-down', tile: 'red', tone: 'red' }
}

function openPoints() {
  uni.switchTab({ url: '/pages/points/index' })
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

    <!-- 首次加载骨架：布局与真实内容一一对应，避免数据到达后跳动 -->
    <template v-if="loading">
      <view class="card">
        <view class="sk-head">
          <view class="sk sk-line w40" />
          <view class="sk sk-line w24" />
        </view>
        <view class="hero-sk-nums">
          <view class="sk sk-num w32" />
          <view class="sk sk-num w32" />
        </view>
      </view>
      <view class="card">
        <view class="sk sk-line w28" />
        <view class="shortcut-grid">
          <view v-for="n in 6" :key="n" class="shortcut">
            <view class="sk sk-tile" />
            <view class="sk sk-line sk-label" />
          </view>
        </view>
      </view>
      <view class="card">
        <view class="sk sk-line w36" />
        <view v-for="n in 3" :key="n" class="record-row recent-row">
          <view class="sk sk-avatar" />
          <view class="sk-lines">
            <view class="sk sk-line w64" />
            <view class="sk sk-line w32" />
          </view>
          <view class="sk sk-line w20" />
        </view>
      </view>
    </template>

    <template v-else>
      <view class="hero card-hero fade-up">
        <view class="hero-top">
          <view class="hero-who">
            <text class="hero-name">{{ home.employee?.name || '员工' }}</text>
            <text class="hero-dept">{{ home.employee?.departmentName || '未分配部门' }}</text>
          </view>
          <view class="hero-chip">本月 {{ monthDeltaText }}</view>
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

      <view v-if="offlineMode" class="card notice fade-up d1">
        <AppIcon name="alert-triangle" :size="32" color="amber" />
        <text class="muted">离线模式，展示上次成功数据</text>
      </view>
      <view v-if="authError && !offlineMode" class="card notice-col fade-up d1">
        <view class="notice">
          <AppIcon name="alert-triangle" :size="32" color="red" />
          <text class="muted">{{ authError }}</text>
        </view>
        <view class="button notice-button" @tap="relogin">重新登录</view>
      </view>

      <view class="card fade-up d1">
        <view class="block-title">快捷入口</view>
        <view class="shortcut-grid">
          <view v-for="item in shortcuts" :key="item.label" class="shortcut press" @tap="item.action()">
            <view class="shortcut-icon-wrap">
              <view class="icon-tile shortcut-icon" :class="item.tile">
                <AppIcon :name="item.icon" :size="44" :color="item.tone" />
              </view>
              <text v-if="badgeCount(item) > 0" class="shortcut-badge">{{ badgeCount(item) > 99 ? '99+' : badgeCount(item) }}</text>
            </view>
            <text class="shortcut-label">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="card fade-up d2">
        <view class="row between block-title-row">
          <text class="block-title">最近积分变动</text>
          <view class="more-link press" @tap="openPoints">
            <text class="link">查看全部</text>
            <AppIcon name="chevron-right" :size="26" color="muted" />
          </view>
        </view>
        <EmptyState v-if="recent.length === 0" icon="inbox" title="暂无积分流水" />
        <view v-for="record in recent" :key="record.id" class="record-row recent-row">
          <view class="icon-tile recent-icon" :class="recordIcon(record).tile">
            <AppIcon :name="recordIcon(record).icon" :size="34" :color="recordIcon(record).tone" />
          </view>
          <view class="recent-main">
            <text class="recent-title">{{ record.remark }}</text>
            <text class="muted">{{ friendlyTime(record.occurredAt || record.createdAt) }}</text>
          </view>
          <text class="recent-amount" :class="record.pointsDelta > 0 ? 'pos' : 'neg'">
            {{ record.pointsDelta > 0 ? '+' : '' }}{{ formatPoints(record.pointsDelta) }}
          </text>
        </view>
      </view>
    </template>

    <view class="settings-toggle muted" @tap="toggleSettings">{{ showSettings ? '收起设置' : '展开设置' }}</view>
    <view v-if="showSettings" class="card">
      <text class="muted">API_BASE</text>
      <input v-model="apiBase" class="input" placeholder="http://192.168.x.x:3000" />
      <text class="muted">wecomUserId</text>
      <input v-model="wecomUserId" class="input" placeholder="zhangsan" />
      <view class="row settings-actions">
        <view class="button" @tap="saveSettings">保存</view>
        <view class="button ghost" @tap="relogin">保存并登录</view>
      </view>
    </view>
    <AiFloatBall />
    <AppTabBar />
  </view>
</template>

<style scoped>
/* ── 顶部积分卡 ── */
.hero {
  /* 与 .card 的 margin-bottom 对齐：信息卡→快捷入口、快捷入口→最近变动 间距一致 */
  margin-bottom: 20rpx;
  padding: 36rpx 32rpx;
  border-radius: var(--r-xl);
  background: linear-gradient(135deg, var(--brand-grad-a), var(--brand-grad-b));
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.hero-who {
  flex: 1;
  min-width: 0;
}

.hero-name {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  letter-spacing: 0.5rpx;
}

.hero-dept {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  opacity: 0.82;
}

.hero-chip {
  flex-shrink: 0;
  padding: 8rpx 20rpx;
  border-radius: var(--r-full);
  background: rgba(255, 255, 255, 0.2);
  font-size: 22rpx;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
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
  letter-spacing: 0.5rpx;
}

.hero-note {
  display: block;
  margin-top: 16rpx;
  font-size: 20rpx;
  opacity: 0.75;
}

/* ── 离线/鉴权提示 ── */
.notice {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.notice-button {
  margin-top: 16rpx;
}

/* ── 区块标题 ── */
.block-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--ink);
}

.block-title-row {
  margin-bottom: 8rpx;
}

.more-link {
  display: flex;
  align-items: center;
}

/* ── 快捷入口 ── */
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

.shortcut-icon-wrap {
  position: relative;
}

.shortcut-icon {
  width: 88rpx;
  height: 88rpx;
}

.shortcut-badge {
  position: absolute;
  top: -10rpx;
  right: -14rpx;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  padding: 0 8rpx;
  border-radius: var(--r-full);
  background: var(--red);
  color: #fff;
  font-size: 18rpx;
  font-weight: 600;
  text-align: center;
  box-sizing: border-box;
}

.shortcut-label {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: var(--ink-2);
}

/* ── 最近积分变动 ── */
.recent-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.recent-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
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
  color: var(--ink);
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

/* ── 骨架占位尺寸 ── */
.sk-head {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.hero-sk-nums {
  display: flex;
  gap: 96rpx;
  margin-top: 40rpx;
}

.sk-line {
  height: 28rpx;
}

.sk-num {
  height: 56rpx;
  border-radius: 14rpx;
}

.sk-tile {
  width: 88rpx;
  height: 88rpx;
  border-radius: var(--r-lg);
}

.sk-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--r-full);
}

.sk-label {
  margin-top: 12rpx;
  height: 20rpx;
  width: 56rpx;
}

.sk-lines {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.w20 { width: 20%; }
.w24 { width: 24%; }
.w28 { width: 28%; }
.w32 { width: 32%; }
.w36 { width: 36%; }
.w40 { width: 40%; }
.w64 { width: 64%; }

/* ── 调试设置（默认隐藏） ── */
.settings-toggle {
  text-align: center;
  padding: 16rpx 0;
}

.settings-actions {
  gap: 16rpx;
  margin-top: 16rpx;
}

.settings-actions .button {
  flex: 1;
}
</style>
