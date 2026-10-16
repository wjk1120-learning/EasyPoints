<script setup lang="ts">
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { fetchVotesPaged } from '../../api/vote/vote'
import type { VoteSummary } from '../../api/vote/types'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

type Scope = 'pending' | 'history'

const rows = ref<VoteSummary[]>([])
const tab = ref<Scope>('pending')
const loading = ref(false)
/** 上拉分页（契约 9.7 PageResult，scope=pending/history 服务端裁剪） */
const PAGE_SIZE = 20
const page = ref(1)
const total = ref(0)
const hasMore = computed(() => rows.value.length < total.value)

onShow(() => loadPage(1))
onReachBottom(() => {
  if (hasMore.value) loadPage(page.value + 1)
})

async function loadPage(target: number) {
  loading.value = true
  try {
    const paged = await fetchVotesPaged(tab.value, { page: target, pageSize: PAGE_SIZE })
    total.value = paged.meta.total
    page.value = target
    rows.value = target === 1 ? paged.data : [...rows.value, ...paged.data]
  } catch (error) {
    uni.showToast({ title: (error as Error)?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchTab(next: Scope) {
  if (tab.value === next) return
  tab.value = next
  loadPage(1)
}

function openVote(item: VoteSummary) {
  uni.navigateTo({ url: `/pages/vote/index?id=${encodeURIComponent(String(item.id))}` })
}

/** 契约 9.7 deadline 已是 yyyy-MM-dd HH:mm，截 MM-DD HH:mm 展示 */
function deadlineOf(item: VoteSummary) {
  if (!item.deadline) return ''
  const matched = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(String(item.deadline))
  return matched ? `${matched[2]}-${matched[3]} ${matched[4]}:${matched[5]}` : String(item.deadline)
}

function modeOf(item: VoteSummary) {
  return item.mode === 'multiple' || item.multiple === true ? '多选' : '单选'
}

function pillOf(item: VoteSummary) {
  if (item.submitted) return { label: '已提交', cls: 'green' }
  if (tab.value === 'pending') return { label: '待参与', cls: 'blue' }
  return { label: '已结束', cls: '' }
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="我的投票" />

    <view class="segmented">
      <text class="tab" :class="{ active: tab === 'pending' }" @tap="switchTab('pending')">待参与投票</text>
      <text class="tab" :class="{ active: tab === 'history' }" @tap="switchTab('history')">历史投票</text>
    </view>

    <view v-if="loading" class="card card-empty">
      <view class="sk-vote-list">
        <view v-for="n in 3" :key="n" class="sk-vote">
          <view class="sk sk-line w40" />
          <view class="sk sk-line w64" />
          <view class="sk-opts">
            <view class="sk sk-opt" />
            <view class="sk sk-opt sk-opt-s" />
            <view class="sk sk-opt" />
          </view>
        </view>
      </view>
    </view>
    <template v-else>
      <view v-for="item in rows" :key="item.id" class="card vote-card press" @tap="openVote(item)">
        <view class="row between">
          <text class="vote-title">{{ item.title }}</text>
          <text class="pill" :class="pillOf(item).cls">{{ pillOf(item).label }}</text>
        </view>
        <text v-if="item.description" class="vote-desc">{{ item.description }}</text>
        <view v-if="item.relatedLabel" class="vote-related">
          <AppIcon name="bookmark" :size="22" color="muted" />
          <text>{{ item.relatedLabel }}</text>
        </view>
        <view class="row between vote-meta">
          <text class="muted">{{ modeOf(item) }}</text>
          <text v-if="deadlineOf(item)" class="vote-deadline" :class="{ neg: tab === 'pending' }">截至 {{ deadlineOf(item) }}</text>
        </view>
      </view>
      <view v-if="rows.length === 0" class="card card-empty">
        <EmptyState icon="check-square" :title="tab === 'pending' ? '暂无待参与投票' : '暂无历史投票'" />
      </view>
      <view v-if="rows.length > 0" class="list-footer">{{ hasMore ? '上拉加载更多' : '已展示全部投票' }}</view>
    </template>

    <AppTabBar />
  </view>
</template>

<style scoped>
.vote-card {
  padding: 26rpx 28rpx;
}

.vote-card:active {
  opacity: 0.9;
}

.vote-title {
  flex: 1;
  min-width: 0;
  margin-right: 16rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vote-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--ink-3);
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vote-related {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: var(--ink-3);
}

.vote-meta {
  margin-top: 14rpx;
}

.vote-deadline {
  font-size: 22rpx;
  color: var(--muted);
}

.list-footer {
  text-align: center;
  padding: 8rpx 0;
  font-size: 22rpx;
  color: var(--faint);
}

/* ── 加载骨架（对应投票卡：两行文字 + 一排小选项块） ── */
.sk-vote-list {
  display: flex;
  flex-direction: column;
  gap: 36rpx;
}

.sk-vote {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.sk-opts {
  display: flex;
  gap: 12rpx;
  margin-top: 4rpx;
}

.sk-opt {
  width: 112rpx;
  height: 40rpx;
  border-radius: var(--r-full);
}

.sk-opt-s {
  width: 88rpx;
}

.sk-line {
  height: 28rpx;
}

.w40 { width: 40%; }
.w64 { width: 64%; }
</style>
