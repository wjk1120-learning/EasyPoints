<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { request } from '../../api'
import NavBar from '../../components/NavBar.vue'

const groups = ref({})
const balance = ref(null)
const loading = ref(false)
const filter = ref('all')

const currentMonth = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`
})

const monthIn = computed(() => sumMonth((delta) => delta > 0))
const monthOut = computed(() => sumMonth((delta) => delta < 0))

function sumMonth(match) {
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

const typeLabel = (record) => {
  if (Number(record.pointsDelta) > 0 && record.sourceType !== 'manual_adjustment' && !['reward', 'penalty'].includes(record.type)) return '积分增加'
  if (Number(record.pointsDelta) < 0 && record.type !== 'reward') return '积分消耗'
  if (record.sourceType === 'manual_adjustment' || ['reward', 'penalty'].includes(record.type)) return '人工奖惩'
  return Number(record.pointsDelta) > 0 ? '积分增加' : '积分消耗'
}

const rows = computed(() => {
  const list = []
  Object.keys(groups.value || {}).forEach((month) => {
    ;(groups.value[month] || []).forEach((record) => list.push({ ...record, month }))
  })
  return list
    .filter((record) => {
      if (filter.value === 'in') return Number(record.pointsDelta) > 0 && record.sourceType !== 'manual_adjustment' && !['reward', 'penalty'].includes(record.type)
      if (filter.value === 'out') return Number(record.pointsDelta) < 0 && !['reward', 'penalty'].includes(record.type)
      if (filter.value === 'manual') return record.sourceType === 'manual_adjustment' || ['reward', 'penalty'].includes(record.type)
      return true
    })
    .sort((a, b) => String(b.occurredAt || b.createdAt || '').localeCompare(String(a.occurredAt || a.createdAt || '')))
})

const chips = [
  { key: 'all', label: '全部' },
  { key: 'in', label: '积分增加' },
  { key: 'out', label: '积分消耗' },
  { key: 'manual', label: '人工奖惩' }
]

onShow(loadRecords)

async function loadRecords() {
  loading.value = true
  try {
    groups.value = await request('/miniapp/points/records')
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
  try {
    const home = await request('/miniapp/home')
    balance.value = Number(home?.pointsBalance || 0)
  } catch {}
}

function pickFilter() {
  uni.showActionSheet({
    itemList: chips.map((chip) => chip.label),
    success(res) {
      filter.value = chips[res.tapIndex].key
    }
  })
}

function iconOf(record) {
  if (typeLabel(record) === '人工奖惩') return { emoji: '⚡', cls: 'purple' }
  return Number(record.pointsDelta) > 0 ? { emoji: '↑', cls: 'green' } : { emoji: '↓', cls: 'red' }
}

function appeal(record) {
  const query = [
    `recordId=${record.id}`,
    `remark=${encodeURIComponent(record.remark || '')}`,
    `points=${record.pointsDelta ?? 0}`,
    `time=${encodeURIComponent(record.occurredAt || record.createdAt || '')}`
  ].join('&')
  uni.navigateTo({ url: `/pages/appeal/index?${query}` })
}

function formatPoints(value) {
  const num = Number(value || 0)
  const abs = String(Math.abs(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return num < 0 ? `-${abs}` : abs
}

function signedPoints(value) {
  const num = Number(value || 0)
  return `${num > 0 ? '+' : ''}${formatPoints(num)}`
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  return `${m}-${d} ${hh}:${mm}`
}
</script>

<template>
  <view class="page page-tab page-nav">
    <NavBar title="积分明细" :back="false" right="筛选" @right="pickFilter" />

    <view class="card head-card">
      <view class="row between">
        <view class="head-main">
          <text class="head-label">当前实时积分</text>
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
          @tap="filter = chip.key"
        >{{ chip.label }}</text>
      </view>
    </view>

    <view v-if="loading" class="card card-empty"><text class="muted">加载中...</text></view>
    <view v-for="record in rows" :key="record.id" class="card record-card" @tap="appeal(record)">
      <view class="icon-tile record-icon" :class="iconOf(record).cls">{{ iconOf(record).emoji }}</view>
      <view class="record-main">
        <text class="record-title">{{ record.remark }}</text>
        <text class="muted">{{ formatTime(record.occurredAt || record.createdAt) }} · {{ typeLabel(record) }}</text>
      </view>
      <text class="record-amount" :class="record.pointsDelta > 0 ? 'pos' : 'neg'">
        {{ signedPoints(record.pointsDelta) }}
      </text>
    </view>
    <view v-if="!loading && rows.length === 0" class="card card-empty"><text class="muted">暂无符合条件的积分记录</text></view>
  </view>
</template>

<style scoped>
.head-card {
  padding: 28rpx 32rpx;
}

.head-label {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
}

.head-num {
  display: block;
  margin-top: 6rpx;
  font-size: 56rpx;
  font-weight: 800;
  color: #1a2233;
  font-variant-numeric: tabular-nums;
}

.head-month {
  align-self: flex-start;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #9aa1ab;
}

.chips {
  display: flex;
  gap: 32rpx;
  margin-top: 24rpx;
}

.chip {
  font-size: 26rpx;
  color: #6b7280;
  padding: 8rpx 0;
}

.chip-on {
  color: #2f6bff;
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
  color: #1a2233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-amount {
  flex-shrink: 0;
  font-size: 32rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
