<script setup lang="ts">
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { fetchMessages, markMessageRead } from '../../api/message/message'
import type { Message } from '../../api/message/types'
import { friendlyTime } from '../../utils/format'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

const messages = ref<Message[]>([])
const loading = ref(false)
const typeFilter = ref('all')
/** 上拉分页（契约 10.1 PageResult，按时间倒序追加） */
const PAGE_SIZE = 20
const page = ref(1)
const total = ref(0)
const hasMore = computed(() => messages.value.length < total.value)

const FILTERS = ['all', '积分变动', '兑换审核', '任务审核', '积分申请', '申诉结果', '投票', '其他']

const unreadCount = computed(() => messages.value.filter((item) => !item.isRead).length)

const visibleMessages = computed(() => {
  if (typeFilter.value === 'all') return messages.value
  return messages.value.filter((item) => typeMeta(item).label === typeFilter.value)
})

/** 消息类型映射（契约附录 E 枚举；正文关键词仅作容错兜底） */
const TYPE_META: Record<string, { label: string; icon: string; tile: string }> = {
  point_changed: { label: '积分变动', icon: 'activity', tile: 'green' },
  order_status: { label: '兑换审核', icon: 'shopping-bag', tile: 'blue' },
  task_review: { label: '任务审核', icon: 'clipboard', tile: 'amber' },
  application_review: { label: '积分申请', icon: 'file-text', tile: 'purple' },
  appeal_result: { label: '申诉结果', icon: 'shield', tile: 'green' },
  vote_invitation: { label: '投票', icon: 'check-square', tile: 'purple' }
}

function typeMeta(item: Message) {
  const byType = TYPE_META[item?.type || '']
  if (byType) return byType
  const text = `${item?.title || ''} ${item?.summary || ''}`
  if (/投票/.test(text)) return TYPE_META.vote_invitation
  if (/兑换|订单/.test(text)) return TYPE_META.order_status
  if (/任务/.test(text)) return TYPE_META.task_review
  if (/申诉/.test(text)) return TYPE_META.appeal_result
  if (/申请/.test(text)) return TYPE_META.application_review
  if (/积分/.test(text)) return TYPE_META.point_changed
  return { label: '其他', icon: 'bell', tile: 'blue' }
}

onShow(() => loadPage(1))
onReachBottom(() => {
  if (hasMore.value) loadPage(page.value + 1)
})

async function loadPage(target: number) {
  loading.value = true
  try {
    const paged = await fetchMessages({ page: target, pageSize: PAGE_SIZE })
    total.value = paged.meta.total
    page.value = target
    // 兼容：后端把 isRead 序列化成了 read（Lombok/Jackson 命名坑），归一为 isRead
    const rows = paged.data.map((row) => ({ ...row, isRead: row.isRead ?? row.read ?? false }))
    messages.value = target === 1 ? rows : [...messages.value, ...rows]
  } catch (error) {
    uni.showToast({ title: (error as Error)?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function isVote(item: Message) {
  return typeMeta(item).label === '投票'
}

/** 本会话已提交过已读的消息（防返回列表旧渲染时重复提交；后端对重复标已读会 404「消息不存在」） */
const readSubmitted = new Set<string>()

async function openMessage(item: Message) {
  const key = String(item.id)
  if (!item?.isRead && !readSubmitted.has(key)) {
    readSubmitted.add(key)
    try {
      await markMessageRead(item.id)
      item.isRead = true
    } catch (error) {
      // 后端口径：已读过的消息再标会 404「消息不存在」，等价于已读，静默置为已读
      if (String((error as Error)?.message || '').includes('消息不存在')) {
        item.isRead = true
      }
    }
  }
  if (isVote(item)) {
    // 顶层 voteId 深链（契约 10.1/R8），直达投票详情
    uni.navigateTo({ url: item.voteId ? `/pages/vote/index?id=${encodeURIComponent(String(item.voteId))}` : '/pages/votes/index' })
    return
  }
  // 深链业务 ID 透传（后端在消息行带出后，详情页可直达申诉表单——反馈清单 #3）
  const deepLinkIds = (['applicationId', 'orderId', 'claimId', 'pointRecordId'] as const)
    .filter((key) => item[key] != null && item[key] !== '')
    .map((key) => `${key}=${item[key]}`)
  const query = [
    `id=${item.id}`,
    `title=${encodeURIComponent(item.title || '')}`,
    `summary=${encodeURIComponent(item.summary || '')}`,
    `type=${encodeURIComponent(item.type || '')}`,
    `createdAt=${encodeURIComponent(item.createdAt || '')}`,
    ...deepLinkIds
  ].join('&')
  uni.navigateTo({ url: `/pages/message/index?${query}` })
}

/**
 * 全部已读：对未读逐条单标（契约 10.2）。
 * 不走 10.3 read-all：后端批量接口排除了 failed 消息（status != 'failed'），但列表把 failed
 * 显示为未读且单条接口可标——口径自相矛盾（已反馈后端），修好前用逐条兜底。
 */
async function markAllRead() {
  const unread = messages.value.filter((item) => !item.isRead && !readSubmitted.has(String(item.id)))
  if (!unread.length) return
  unread.forEach((item) => readSubmitted.add(String(item.id)))
  try {
    await Promise.allSettled(unread.map((item) => markMessageRead(item.id)))
    unread.forEach((item) => {
      item.isRead = true
    })
    uni.showToast({ title: '已全部标记为已读', icon: 'none' })
  } catch (error) {
    uni.showToast({ title: (error as Error)?.message || '操作失败', icon: 'none' })
  }
}

function pickType() {
  uni.showActionSheet({
    itemList: FILTERS.map((label) => (label === 'all' ? '全部类型' : label)),
    success(res) {
      typeFilter.value = FILTERS[res.tapIndex]
    }
  })
}

function displayTitle(item: Message) {
  if (isVote(item) && (!item.title || item.title === '系统通知')) return '有新的投票待你参与'
  return item.title || ''
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="通知中心" />

    <view class="list-head">
      <text class="list-head-text">{{ unreadCount > 0 ? `${unreadCount} 条未读消息` : '消息已全部已读' }}</text>
      <view class="list-head-actions">
        <text v-if="unreadCount > 0" class="list-head-read" @tap="markAllRead">全部已读</text>
        <view class="list-head-filter" @tap="pickType">
          <AppIcon name="list" :size="26" color="brand" />
          <text>{{ typeFilter === 'all' ? '全部类型' : typeFilter }}</text>
        </view>
      </view>
    </view>

    <!-- 加载骨架：行式（圆点 + 两行文字），布局与消息行一致 -->
    <template v-if="loading">
      <view v-for="n in 4" :key="`sk-${n}`" class="msg">
        <view class="sk sk-icon" />
        <view class="sk-lines">
          <view class="sk sk-line w64" />
          <view class="sk sk-line w40" />
        </view>
      </view>
    </template>

    <view
      v-for="item in visibleMessages"
      :key="item.id"
      class="msg press"
      :class="{ 'msg-read': item.isRead }"
      @tap="openMessage(item)"
    >
      <view class="icon-tile msg-icon" :class="typeMeta(item).tile">
        <AppIcon :name="typeMeta(item).icon" :size="36" :color="typeMeta(item).tile === 'blue' ? 'brand' : typeMeta(item).tile" />
        <view v-if="!item.isRead" class="msg-dot" />
      </view>
      <view class="msg-main">
        <view class="row between">
          <text class="msg-title" :class="{ 'msg-title-read': item.isRead }">{{ displayTitle(item) }}</text>
          <text class="msg-time">{{ friendlyTime(item.createdAt, 'date') }}</text>
        </view>
        <text class="msg-summary" :class="{ 'msg-summary-read': item.isRead }">{{ item.summary }}</text>
        <text class="msg-tag" :class="`tag-${typeMeta(item).tile}`">{{ typeMeta(item).label }}</text>
      </view>
    </view>

    <view v-if="!loading && visibleMessages.length === 0" class="card card-empty">
      <EmptyState icon="bell" title="暂无通知" />
    </view>
    <view v-if="visibleMessages.length > 0" class="list-footer">{{ hasMore ? "上拉加载更多" : "已展示全部消息" }}</view>

    <AppTabBar />
  </view>
</template>

<style scoped>
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -8rpx 4rpx 20rpx;
}

.list-head-text {
  font-size: 24rpx;
  color: var(--muted);
}

.list-head-actions {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.list-head-read {
  font-size: 24rpx;
  color: var(--brand);
  font-weight: 500;
}

.list-head-read:active {
  opacity: 0.6;
}

.list-head-filter {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 24rpx;
  color: var(--ink-3);
}

.list-head-filter:active {
  opacity: 0.6;
}

.msg {
  display: flex;
  gap: 20rpx;
  padding: 26rpx 28rpx;
  margin-bottom: 16rpx;
  border-radius: 20rpx;
  background: var(--surface);
  box-shadow: 0 1rpx 2rpx rgba(23, 26, 31, 0.03), 0 8rpx 24rpx rgba(23, 26, 31, 0.04);
}

.msg:active {
  opacity: 0.9;
}

.msg-read {
  background: #fafbfc;
  box-shadow: none;
}

.msg-icon {
  position: relative;
  width: 80rpx;
  height: 80rpx;
  font-size: 36rpx;
}

.msg-dot {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  width: 16rpx;
  height: 16rpx;
  border-radius: 999rpx;
  background: var(--red);
  border: 3rpx solid var(--surface);
  box-sizing: content-box;
}

.msg-main {
  flex: 1;
  min-width: 0;
}

.msg-title {
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

.msg-title-read {
  font-weight: 500;
  color: var(--ink-3);
}

.msg-time {
  flex-shrink: 0;
  font-size: 22rpx;
  color: var(--faint);
}

.msg-summary {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-summary-read {
  color: var(--muted);
}

.msg-tag {
  display: inline-block;
  margin-top: 12rpx;
  font-size: 22rpx;
}

.tag-blue { color: var(--brand); }
.tag-green { color: var(--green); }
.tag-amber { color: var(--amber); }
.tag-purple { color: var(--purple); }
.tag-red { color: var(--red); }

.list-footer {
  text-align: center;
  padding: 16rpx 0 8rpx;
  font-size: 22rpx;
  color: var(--faint);
}

/* ── 加载骨架尺寸 ── */
.sk-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: var(--r-full);
}

.sk-line {
  height: 28rpx;
}

.sk-lines {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.w40 { width: 40%; }
.w64 { width: 64%; }
</style>
