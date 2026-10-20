<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { getCachedData, isNetworkError, type WithOfflineFlag } from '../../utils/request'
import { homeBadges } from '../../utils/badge-state'
import { fetchHome } from '../../api/home/home'
import type { HomeVo } from '../../api/home/types'
import type { PointRecordItem } from '../../api/points/types'
import { fetchVotesPaged } from '../../api/vote/vote'
import { fetchOrders } from '../../api/order/order'
import { fetchApplications } from '../../api/application/application'
import { formatPoints, friendlyTime } from '../../utils/format'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

const home = ref<HomeVo>({ pointsBalance: 0, monthDelta: 0, unreadMessages: 0, employee: {} })
const recent = ref<PointRecordItem[]>([])
const pendingVotes = ref(0)
const pendingOrders = ref(0)
const pendingApplications = ref(0)
const loading = ref(true)
const authError = ref('')
const offlineMode = ref(false)

const availablePoints = computed(() => Number(home.value.pointsBalance || 0))
const actualPoints = computed(() => {
  const value = home.value.actualPoints
  return value == null ? null : Number(value)
})
const monthDeltaText = computed(() => {
  const delta = Number(home.value.monthDelta || 0)
  return `${delta > 0 ? '+' : ''}${formatPoints(delta)}`
})

type Shortcut = {
  label: string
  icon: string
  tile: string
  tone: string
  badge?: 'messages' | 'votes' | 'orders' | 'applications'
  action: () => void
}

// 快捷入口 6 项 = 用户定稿口径（2026-10-16，2026-10-20「申请中心」更名「我的申请」并直落列表）：
// 我的申请/通知中心/投票中心/积分排名/兑换记录/规则中心
// （积分商城、任务大厅走底部标签，不再占快捷入口）；配色互不重复：紫/红/绿/橙/蓝/灰
const shortcuts: Shortcut[] = [
  { label: '我的申请', icon: 'file-text', tile: 'purple', tone: 'purple', badge: 'applications', action: () => uni.navigateTo({ url: '/pages/apply/index?view=mine' }) },
  { label: '通知中心', icon: 'bell', tile: 'red', tone: 'red', badge: 'messages', action: () => uni.navigateTo({ url: '/pages/messages/index' }) },
  { label: '投票中心', icon: 'check-square', tile: 'green', tone: 'green', badge: 'votes', action: () => uni.navigateTo({ url: '/pages/votes/index' }) },
  { label: '积分排名', icon: 'trophy', tile: 'amber', tone: 'amber', action: () => uni.navigateTo({ url: '/pages/leaderboard/index' }) },
  { label: '兑换记录', icon: 'shopping-bag', tile: 'blue', tone: 'brand', badge: 'orders', action: () => uni.navigateTo({ url: '/pages/orders/index' }) },
  { label: '规则中心', icon: 'book-open', tile: '', tone: 'gray', action: () => uni.navigateTo({ url: '/pages/rules/index' }) }
]

async function load() {
  authError.value = uni.getStorageSync('employeeAuthError') || ''
  try {
    // 无 token 时由请求内核先走 ensureEmployeeLogin（dev 直登/企微 OAuth），页面只管拉数据
    const data = await fetchHome()
    applyHomeData(data, Boolean(data?.__offline))
    recent.value = data.recentRecords ?? []
    loadPendingVotes()
    loadPendingOrders()
    loadPendingApplications()
  } catch (error) {
    const cached = getCachedData('/miniapp/home')
    if (cached && isNetworkError(error)) {
      applyHomeData(cached as WithOfflineFlag<HomeVo>, true)
      return
    }
    offlineMode.value = false
    authError.value = (error as Error)?.message || '加载失败'
    uni.showToast({ title: authError.value, icon: 'none' })
  } finally {
    loading.value = false
  }
}

onShow(() => load())

/** 错误横幅「重新登录」：清错误标记后重走 登录+拉数据 */
function retry() {
  uni.removeStorageSync('employeeAuthError')
  loading.value = true
  load()
}

onPullDownRefresh(async () => {
  try {
    const data = await fetchHome()
    applyHomeData(data, Boolean(data?.__offline))
    recent.value = data.recentRecords ?? []
    loadPendingVotes()
    loadPendingOrders()
    loadPendingApplications()
  } catch {} finally {
    uni.stopPullDownRefresh()
  }
})

// 待参与角标：scope=pending 的 total 即未提交且未截止的投票数
async function loadPendingVotes() {
  try {
    const page = await fetchVotesPaged('pending', { page: 1, pageSize: 50 })
    pendingVotes.value = page.meta.total
  } catch {
    pendingVotes.value = 0
  }
  homeBadges.votes = pendingVotes.value
}

// 审核中兑换订单角标：status=pending_review 全量列表长度（个人订单量级小）
async function loadPendingOrders() {
  try {
    const list = await fetchOrders('pending_review')
    pendingOrders.value = list.length
  } catch {
    pendingOrders.value = 0
  }
  homeBadges.orders = pendingOrders.value
}

// 进行中（待审核）积分申请角标：契约 6.2 无 status 筛选，取列表内 pending_review 计数
async function loadPendingApplications() {
  try {
    const page = await fetchApplications({ page: 1, pageSize: 50 })
    pendingApplications.value = page.data.filter((item) => item.status === 'pending_review').length
  } catch {
    pendingApplications.value = 0
  }
  homeBadges.applications = pendingApplications.value
}

function badgeCount(item: Shortcut): number {
  if (item.badge === 'messages') return Number(home.value.unreadMessages || 0)
  if (item.badge === 'votes') return pendingVotes.value
  if (item.badge === 'orders') return pendingOrders.value
  if (item.badge === 'applications') return pendingApplications.value
  return 0
}

function applyHomeData(data: WithOfflineFlag<HomeVo>, offline: boolean) {
  const next = { ...(data || {}) }
  delete next.__offline
  home.value = next
  homeBadges.messages = Number(next.unreadMessages || 0)
  offlineMode.value = offline
  if (!offline) uni.removeStorageSync('employeeAuthError')
}

function recordIcon(record: PointRecordItem): { icon: string; tile: string; tone: string } {
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
          <view v-for="n in 7" :key="n" class="shortcut">
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
        <view class="button notice-button" @tap="retry">重新登录</view>
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
          <text class="recent-amount" :class="Number(record.pointsDelta || 0) > 0 ? 'pos' : 'neg'">
            {{ Number(record.pointsDelta || 0) > 0 ? '+' : '' }}{{ formatPoints(record.pointsDelta) }}
          </text>
        </view>
      </view>
    </template>

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

</style>
