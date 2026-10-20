<script setup lang="ts">
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { fetchAppeals } from '../../api/appeal/appeal'
import type { Appeal } from '../../api/appeal/types'
import { formatTime } from '../../utils/format'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

type TabKey = 'all' | 'pending_review' | 'approved' | 'rejected'

/** 契约 7.2：status 为服务端筛选（一级三态，无「已完成」聚合值，approved/rejected 分开查） */
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending_review', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已驳回' }
]

const rows = ref<Appeal[]>([])
const tab = ref<TabKey>('all')
const loading = ref(false)
/** 上拉分页（契约 7.2 PageResult，按提交时间倒序追加） */
const PAGE_SIZE = 20
const page = ref(1)
const total = ref(0)
const hasMore = computed(() => rows.value.length < total.value)

/** 目标类型中文（与申诉表单 TARGET_LABELS 同口径） */
const TARGET_LABELS: Record<string, string> = {
  point_record: '积分明细',
  order: '兑换订单',
  task_claim: '任务',
  point_application: '积分申请'
}

onShow(() => loadPage(1))
onReachBottom(() => {
  if (hasMore.value) loadPage(page.value + 1)
})

async function loadPage(target: number) {
  loading.value = true
  try {
    const params: { page: number; pageSize: number; status?: string } = { page: target, pageSize: PAGE_SIZE }
    if (tab.value !== 'all') params.status = tab.value
    const paged = await fetchAppeals(params)
    total.value = paged.meta.total
    page.value = target
    rows.value = target === 1 ? paged.data : [...rows.value, ...paged.data]
  } catch (error) {
    uni.showToast({ title: (error as Error)?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchTab(next: TabKey) {
  if (tab.value === next) return
  tab.value = next
  loadPage(1)
}

function targetLabel(item: Appeal) {
  return TARGET_LABELS[item.targetType || ''] || '关联事项'
}

/** 契约 7.2：statusText 为后端计算字段（待审核/审核通过/已驳回），前端只配颜色 */
function statusPill(item: Appeal) {
  const cls = item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'amber'
  return { label: item.statusText || '待审核', cls }
}

function bannerOf(item: Appeal) {
  if (item.status === 'approved') {
    return { cls: 'banner-green', icon: 'check-circle', color: 'green', text: '申诉通过，积分已按结论调整' }
  }
  if (item.status === 'rejected') {
    return {
      cls: 'banner-red',
      icon: 'x-circle',
      color: 'red',
      text: item.resolution ? `处理意见：${item.resolution}` : '申诉未通过，如有疑问联系积分管理员'
    }
  }
  return { cls: 'banner-amber', icon: 'clock', color: 'amber', text: '预计 3 个工作日内完成处理' }
}

function goNewAppeal() {
  uni.switchTab({ url: '/pages/points/index' })
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="申诉记录" />

    <view class="segmented">
      <text
        v-for="t in TABS"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @tap="switchTab(t.key)"
      >{{ t.label }}</text>
    </view>

    <view v-for="item in rows" :key="item.id" class="card appeal-card">
      <view class="row between">
        <text class="appeal-title">{{ item.reason }}</text>
        <text class="pill" :class="statusPill(item).cls">{{ statusPill(item).label }}</text>
      </view>
      <text class="muted appeal-sub">申诉 · {{ targetLabel(item) }} · {{ formatTime(item.createdAt) }}</text>
      <view class="banner" :class="bannerOf(item).cls">
        <AppIcon :name="bannerOf(item).icon" :size="36" :color="bannerOf(item).color" />
        <text class="banner-text">{{ bannerOf(item).text }}</text>
      </view>
    </view>
    <view v-if="!loading && rows.length === 0" class="card card-empty"><EmptyState icon="shield" title="暂无申诉记录" /></view>
    <view v-if="rows.length > 0" class="list-footer">{{ hasMore ? '上拉加载更多' : '已展示全部申诉记录' }}</view>

    <view class="footer-link" @tap="goNewAppeal">从积分明细发起新申诉 ›</view>

    <AppTabBar />
  </view>
</template>

<style scoped>
.appeal-card {
  padding: 28rpx;
}

.appeal-title {
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

.appeal-sub {
  display: block;
  margin-top: 8rpx;
}

.banner {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  margin-top: 20rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  line-height: 1.6;
}

.banner-amber {
  background: var(--amber-soft);
  color: #b45309;
}

.banner-green {
  background: var(--green-soft);
  color: var(--green);
}

.banner-red {
  background: var(--red-soft);
  color: var(--red);
}

.banner-text {
  flex: 1;
  min-width: 0;
}

.list-footer {
  text-align: center;
  padding: 8rpx 0;
  font-size: 22rpx;
  color: var(--faint);
}

.footer-link {
  text-align: center;
  padding: 16rpx 0;
  font-size: 24rpx;
  color: var(--brand);
}

.footer-link:active {
  opacity: 0.6;
}
</style>
