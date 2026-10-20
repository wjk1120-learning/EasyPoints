<script setup lang="ts">
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { fetchPointRecords } from '../../api/points/points'
import type { MonthGroups, PointRecordItem } from '../../api/points/types'
import { fetchHome } from '../../api/home/home'
import { formatPoints, signedPoints, formatTime } from '../../utils/format'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

type FilterKey = 'all' | 'in' | 'out' | 'manual'

const groups = ref<MonthGroups>({})
const balance = ref<number | null>(null)
const loading = ref(false)
const filter = ref<FilterKey>('all')
/** 上拉加载窗口：契约 2.1 无分页（全量按月返回），PRD 4.4「加载更多」用前端窗口化实现 */
const PAGE_STEP = 20
const visibleCount = ref(PAGE_STEP)

const currentMonth = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`
})

const monthIn = computed(() => sumMonth((delta) => delta > 0))
const monthOut = computed(() => sumMonth((delta) => delta < 0))

function sumMonth(match: (delta: number) => boolean): number {
  let total = 0
  Object.keys(groups.value || {}).forEach((month) => {
    if (month !== currentMonth.value) return
    ;(groups.value[month] || []).forEach((record) => {
      const delta = Number(record.pointsDelta || 0)
      if (match(delta)) total += delta
    })
  })
  return total
}

function typeLabel(record: PointRecordItem): string {
  if (Number(record.pointsDelta) > 0 && record.sourceType !== 'manual_adjustment' && !['reward', 'penalty'].includes(record.type || '')) return '积分增加'
  if (Number(record.pointsDelta) < 0 && record.type !== 'reward') return '积分消耗'
  if (record.sourceType === 'manual_adjustment' || ['reward', 'penalty'].includes(record.type || '')) return '人工奖惩'
  return Number(record.pointsDelta) > 0 ? '积分增加' : '积分消耗'
}

/** 过滤 + 时间倒序后的全量列表 */
const rows = computed(() => {
  const list: Array<PointRecordItem & { month: string }> = []
  Object.keys(groups.value || {}).forEach((month) => {
    ;(groups.value[month] || []).forEach((record) => list.push({ ...record, month }))
  })
  return list
    .filter((record) => {
      if (filter.value === 'in') return Number(record.pointsDelta) > 0 && record.sourceType !== 'manual_adjustment' && !['reward', 'penalty'].includes(record.type || '')
      if (filter.value === 'out') return Number(record.pointsDelta) < 0 && !['reward', 'penalty'].includes(record.type || '')
      if (filter.value === 'manual') return record.sourceType === 'manual_adjustment' || ['reward', 'penalty'].includes(record.type || '')
      return true
    })
    .sort((a, b) => String(b.occurredAt || b.createdAt || '').localeCompare(String(a.occurredAt || a.createdAt || '')))
})

/** 当前窗口内可见行（上拉加载更多的渲染切片） */
const visibleRows = computed(() => rows.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < rows.value.length)

const chips: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'in', label: '积分增加' },
  { key: 'out', label: '积分消耗' },
  { key: 'manual', label: '人工奖惩' }
]

onShow(loadRecords)

onReachBottom(() => {
  if (hasMore.value) visibleCount.value += PAGE_STEP
})

async function loadRecords() {
  loading.value = true
  visibleCount.value = PAGE_STEP
  try {
    groups.value = await fetchPointRecords()
  } catch (error) {
    uni.showToast({ title: (error as Error)?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
  try {
    const home = await fetchHome()
    balance.value = Number(home?.pointsBalance || 0)
  } catch {}
}

function setFilter(key: FilterKey) {
  if (filter.value === key) return
  filter.value = key
  visibleCount.value = PAGE_STEP
}

/** 事件描述：来源业务中文 + 操作人（PRD 4.4 事件描述） */
const SOURCE_LABELS: Record<string, string> = {
  task_reward: '任务奖励',
  manual_adjustment: '人工奖惩',
  exchange: '礼品兑换',
  reversal: '冲正',
  appeal_compensation: '申诉补分',
  application: '积分申请'
}

function sourceLabel(record: PointRecordItem): string {
  const byType: Record<string, string> = { reward: '人工加分', penalty: '人工扣分' }
  const base = SOURCE_LABELS[record.sourceType || ''] || byType[record.type || ''] || '积分变动'
  return record.operatorName ? `${base} · ${record.operatorName}` : base
}

/** 当前状态：冲正关系由 reversalOfId 表达（契约缺口：缺「是否已被冲正」字段，见反馈清单） */
function statusOf(record: PointRecordItem): { label: string; cls: string } {
  return record.reversalOfId != null
    ? { label: '冲正流水', cls: 'reversal' }
    : { label: '正常', cls: 'ok' }
}

function iconOf(record: PointRecordItem): { icon: string; cls: string } {
  if (typeLabel(record) === '人工奖惩') return { icon: 'zap', cls: 'purple' }
  return Number(record.pointsDelta) > 0 ? { icon: 'trending-up', cls: 'green' } : { icon: 'trending-down', cls: 'red' }
}

function appeal(record: PointRecordItem) {
  const query = [
    'targetType=point_record',
    `targetId=${record.id}`,
    `remark=${encodeURIComponent(record.remark || '')}`,
    `points=${record.pointsDelta ?? 0}`,
    `time=${encodeURIComponent(record.occurredAt || record.createdAt || '')}`
  ].join('&')
  uni.navigateTo({ url: `/pages/appeal/index?${query}` })
}
</script>

<template>
  <view class="page page-tab page-nav">
    <NavBar title="积分明细" :back="false" />

    <view class="card head-card">
      <view class="row between">
        <view class="head-main">
          <text class="head-label">当前实际积分</text>
          <text class="head-num">{{ balance == null ? '—' : formatPoints(balance) }}</text>
        </view>
        <view class="head-month">
          <text>本月 <text class="pos">+{{ formatPoints(monthIn) }}</text> / <text class="neg">{{ formatPoints(monthOut) }}</text></text>
        </view>
      </view>
      <view class="chips">
        <text
          v-for="chip in chips"
          :key="chip.key"
          class="chip"
          :class="{ 'chip-on': filter === chip.key }"
          @tap="setFilter(chip.key)"
        >{{ chip.label }}</text>
      </view>
    </view>

    <view v-if="loading" class="card card-empty">
      <view v-for="n in 3" :key="n" class="sk-record">
        <view class="sk sk-avatar" />
        <view class="sk-lines">
          <view class="sk sk-line w64" />
          <view class="sk sk-line w32" />
        </view>
        <view class="sk sk-line sk-amount" />
      </view>
    </view>
    <view v-for="record in visibleRows" :key="record.id" class="card record-card press" @tap="appeal(record)">
      <view class="icon-tile record-icon" :class="iconOf(record).cls">
        <AppIcon :name="iconOf(record).icon" :size="32" :color="iconOf(record).cls" />
      </view>
      <view class="record-main">
        <text class="record-title">{{ sourceLabel(record) }}</text>
        <view class="record-meta-line">
          <text class="muted">{{ formatTime(record.occurredAt || record.createdAt) }}</text>
          <text class="status-pill" :class="statusOf(record).cls">{{ statusOf(record).label }}</text>
        </view>
        <text class="record-remark">备注：{{ record.remark || '—' }}</text>
      </view>
      <view class="record-side">
        <text class="record-amount" :class="Number(record.pointsDelta || 0) > 0 ? 'pos' : 'neg'">
          {{ signedPoints(record.pointsDelta) }}
        </text>
        <!-- 申诉入口提示：整卡点击即进申诉页，这里只是可见按键；@tap.stop 防止与整卡触发叠加 -->
        <view class="appeal-chip" @tap.stop="appeal(record)">
          <AppIcon name="shield" :size="20" color="muted" />
          <text>申诉</text>
        </view>
      </view>
    </view>
    <view v-if="!loading && rows.length === 0" class="card card-empty"><EmptyState icon="inbox" title="暂无符合条件的积分流水" /></view>
    <view v-if="!loading && rows.length > 0" class="list-footer">
      {{ hasMore ? '上拉加载更多' : '已展示全部明细' }}
    </view>

    <AppTabBar />
  </view>
</template>

<style scoped>
.head-card {
  padding: 28rpx 32rpx;
}

.head-label {
  display: block;
  font-size: 24rpx;
  color: var(--ink-3);
}

.head-num {
  display: block;
  margin-top: 6rpx;
  font-size: 56rpx;
  font-weight: 800;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.head-month {
  align-self: flex-start;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--muted);
}

.chips {
  display: flex;
  gap: 32rpx;
  margin-top: 24rpx;
}

.chip {
  font-size: 26rpx;
  color: var(--ink-3);
  padding: 8rpx 0;
}

.chip-on {
  color: var(--brand);
  font-weight: 600;
}

.record-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 26rpx 28rpx;
}

.record-card:active {
  opacity: 0.9;
}

.record-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  font-size: 32rpx;
  font-weight: 700;
}

.record-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.record-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-meta-line {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.status-pill {
  padding: 2rpx 12rpx;
  border-radius: var(--r-full);
  font-size: 18rpx;
}

.status-pill.ok {
  color: var(--green);
  background: var(--green-soft);
}

.status-pill.reversal {
  color: #b45309;
  background: var(--amber-soft);
}

/* 操作备注：完整展示（PRD 4.4 五要素之一），最多两行 */
.record-remark {
  font-size: 22rpx;
  color: var(--ink-3);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.record-amount {
  flex-shrink: 0;
  font-size: 32rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* 金额 + 申诉按键的右侧竖排 */
.record-side {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.appeal-chip {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  padding: 4rpx 14rpx;
  border-radius: var(--r-full);
  border: 1rpx solid var(--line);
  background: var(--surface);
  font-size: 20rpx;
  color: var(--muted);
}

.record-card:active .appeal-chip {
  color: var(--brand);
  border-color: var(--brand-soft);
  background: var(--brand-soft);
}

/* ── 骨架占位尺寸 ── */
.sk-record {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 14rpx 0;
}

.sk-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--r-full);
}

.sk-lines {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.sk-line {
  height: 28rpx;
}

.sk-amount {
  width: 96rpx;
  height: 32rpx;
}

.w32 { width: 32%; }
.w64 { width: 64%; }

.list-footer {
  text-align: center;
  padding: 8rpx 0;
  font-size: 22rpx;
  color: var(--faint);
}
</style>
