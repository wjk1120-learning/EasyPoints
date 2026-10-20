<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { fetchTasks, claimTask, submitTask, fetchTaskClaims } from '../../api/task/task'
import type { Task } from '../../api/task/types'
import { uploadImage } from '../../api/upload/upload'
import { homeBadges } from '../../utils/badge-state'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

type ScopeKey = 'all' | 'mine'

const tab = ref<ScopeKey>('all')
const view = ref<'list' | 'submit'>('list')
const rows = ref<Task[]>([])
const missing = ref('')
const loading = ref(false)
const sortByReward = ref(true)
const submitFor = ref<Task | null>(null)
const resultText = ref('')
const resultImages = ref<string[]>([])
const submitting = ref(false)
const detailFor = ref<Task | null>(null)

const claimableCount = computed(() => rows.value.filter((task) => isClaimable(task)).length)
const sortedRows = computed(() => {
  const list = [...rows.value]
  list.sort((a, b) => {
    const pa = Number(a.rewardPoints ?? a.points ?? 0)
    const pb = Number(b.rewardPoints ?? b.points ?? 0)
    return sortByReward.value ? pb - pa : pa - pb
  })
  return list
})

onShow(() => {
  // 消息详情「发起申诉」降级入口：被驳回的领取记录在「我的」标签下，先切再加载（switchTab 不能带参，走 storage 握手）
  if (uni.getStorageSync('tasks:pendingScope') === 'mine') tab.value = 'mine'
  uni.removeStorageSync('tasks:pendingScope')
  load()
})
onPullDownRefresh(async () => {
  await load()
  uni.stopPullDownRefresh()
})

async function load() {
  loading.value = true
  missing.value = ''
  try {
    const page = await fetchTasks(tab.value, { page: 1, pageSize: 50 })
    rows.value = page.data
    // 底栏「任务大厅」数字角标：列表 status 为个人视角，进行中（待提交成果）的数量即待办数
    homeBadges.tasks = rows.value.filter((task) => isRunning(task)).length
  } catch (error) {
    rows.value = []
    missing.value = (error as Error)?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function switchTab(next: ScopeKey) {
  tab.value = next
  view.value = 'list'
  submitFor.value = null
  load()
}

function toggleSort() {
  sortByReward.value = !sortByReward.value
}

function isClaimable(task: Task) {
  return task.status === 'open' || Boolean(task.claimable)
}

function isRunning(task: Task) {
  return task.status === 'in_progress' || Boolean(task.canSubmit)
}

function isReviewing(task: Task) {
  return ['pending_review', 'submitted', 'reviewing'].includes(String(task.status || ''))
}

function isApproved(task: Task) {
  return ['approved', 'passed', 'completed'].includes(String(task.status || ''))
}

function isRejected(task: Task) {
  return ['rejected', 'refused'].includes(String(task.status || ''))
}

function isHistory(task: Task) {
  return ['history', 'archived', 'expired', 'closed'].includes(String(task.status || ''))
}

function statusPill(task: Task) {
  if (isClaimable(task)) return { text: '可领取', cls: 'blue' }
  if (isRunning(task)) return { text: '进行中', cls: 'blue' }
  if (isReviewing(task)) return { text: '待审核', cls: 'amber' }
  if (isApproved(task)) return { text: '审核通过', cls: 'green' }
  if (isRejected(task)) return { text: '已驳回', cls: 'red' }
  if (isHistory(task)) return { text: '历史任务', cls: '' }
  return { text: task.statusText || task.status || '进行中', cls: '' }
}

function rewardOf(task: Task): number {
  const value = task.rewardPoints ?? task.points
  return value == null ? 0 : Number(value)
}

function deadlineOf(task: Task) {
  const value = task.deadline || task.dueAt || task.deadlineAt
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${m}-${d}`
}

async function claim(task: Task) {
  try {
    await claimTask(task.id)
    uni.showToast({ title: '已领取' })
    await load()
  } catch (error) {
    uni.showToast({ title: (error as Error)?.message || '领取失败', icon: 'none' })
  }
}

function openSubmit(task: Task) {
  submitFor.value = task
  resultText.value = String(uni.getStorageSync(`taskDraft:${task.id}`) || '')
  resultImages.value = []
  view.value = 'submit'
}

function saveDraft() {
  if (!submitFor.value) return
  uni.setStorageSync(`taskDraft:${submitFor.value.id}`, resultText.value)
  uni.showToast({ title: '草稿已保存', icon: 'none' })
}

function chooseImage() {
  const left = 9 - resultImages.value.length
  if (left <= 0) {
    uni.showToast({ title: '最多上传 9 张', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: left,
    success(res) {
      resultImages.value = resultImages.value.concat(res.tempFilePaths || []).slice(0, 9)
    }
  })
}

function removeImage(index: number) {
  resultImages.value = resultImages.value.filter((item, i) => i !== index)
}

async function submit() {
  const task = submitFor.value
  if (!task || submitting.value) return
  const content = resultText.value.trim()
  if (!content) {
    uni.showToast({ title: '请填写成果说明', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    // 佐证图先上传（契约 11.9）得到相对路径，再随成果提交（5.2b evidenceImages ≤9）
    const urls: string[] = []
    for (const path of resultImages.value) {
      urls.push(await uploadImage(path))
    }
    await submitTask(task.id, content, urls)
    uni.removeStorageSync(`taskDraft:${task.id}`)
    submitFor.value = null
    resultText.value = ''
    resultImages.value = []
    view.value = 'list'
    uni.showToast({ title: '已提交，等待审核' })
    await load()
  } catch (error) {
    uni.showToast({ title: (error as Error)?.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function openDetail(task: Task) {
  detailFor.value = task
}

/**
 * 被驳回任务直达申诉页（PRD 4.3；targetType=task_claim，契约 7.1）。
 * targetId 必须是领取记录主键（后端按 task_claims.id 校验本人+已驳回），任务行不带该 ID，
 * 先查本人被驳回领取记录按 taskId 匹配换算（一人一任务仅一条记录）。
 */
async function appealTask(task: Task) {
  try {
    const claims = await fetchTaskClaims('rejected', { page: 1, pageSize: 50 })
    const claim = claims.data.find((item) => String(item.taskId) === String(task.id))
    if (!claim) {
      uni.showToast({ title: '未找到可申诉的任务记录', icon: 'none' })
      return
    }
    const query = [
      'targetType=task_claim',
      `targetId=${claim.id}`,
      `remark=${encodeURIComponent(String(task.title || task.name || claim.taskName || '任务'))}`,
      `points=${-rewardOf(task)}`,
      `time=${encodeURIComponent(claim.updatedAt || task.updatedAt || '')}`
    ].join('&')
    uni.navigateTo({ url: `/pages/appeal/index?${query}` })
  } catch (error) {
    uni.showToast({ title: (error as Error)?.message || '发起申诉失败', icon: 'none' })
  }
}

function describe(task: Task) {
  return task.description || task.summary || ''
}
</script>

<template>
  <view class="page page-tab page-nav">
    <NavBar :title="view === 'submit' ? '提交成果' : '任务大厅'" :back="view === 'submit'" @back="view = 'list'" />

    <template v-if="view === 'list'">
      <view class="segmented">
        <text class="tab" :class="{ active: tab === 'all' }" @tap="switchTab('all')">全部任务</text>
        <text class="tab" :class="{ active: tab === 'mine' }" @tap="switchTab('mine')">我的任务</text>
      </view>

      <view v-if="tab === 'all' && !missing" class="list-head">
        <text class="list-head-text">当前可领取 {{ claimableCount }} 个任务</text>
        <text class="list-head-sort" @tap="toggleSort">↕ 按奖励排序{{ sortByReward ? '' : '（低→高）' }}</text>
      </view>

      <view v-if="missing" class="card"><text class="muted">{{ missing }}</text></view>

      <template v-else>
        <template v-if="loading && rows.length === 0">
          <view v-for="n in 3" :key="`sk-${n}`" class="card task-card">
            <view class="row between">
              <view class="sk sk-line w40" />
              <view class="sk sk-line w20" />
            </view>
            <view class="sk sk-line w64 sk-task-desc" />
          </view>
        </template>
        <view v-for="task in sortedRows" :key="task.id" class="card task-card">
          <view class="row between">
            <text class="task-title">{{ task.title || task.name }}</text>
            <text class="pill" :class="statusPill(task).cls">{{ statusPill(task).text }}</text>
          </view>
          <text v-if="describe(task)" class="task-desc">{{ describe(task) }}</text>
          <view class="task-meta">
            <view class="task-reward"><AppIcon name="gift" :size="26" color="brand" /><text>+{{ rewardOf(task) }} 积分</text></view>
            <view v-if="deadlineOf(task)" class="task-deadline"><AppIcon name="calendar" :size="24" color="muted" /><text>截至 {{ deadlineOf(task) }}</text></view>
          </view>

          <template v-if="tab === 'all'">
            <view v-if="isClaimable(task)" class="button task-button" @tap="claim(task)">领取任务</view>
          </template>
          <template v-else>
            <view v-if="isClaimable(task)" class="button task-button" @tap="claim(task)">领取任务</view>
            <view v-else class="task-actions">
              <view v-if="isRunning(task)" class="small-button" @tap="openSubmit(task)">提交成果</view>
              <view v-if="isReviewing(task)" class="small-button ghost press" @tap="openDetail(task)">查看成果</view>
              <view v-if="isApproved(task) || isHistory(task)" class="small-button ghost press" @tap="openDetail(task)">查看详情</view>
              <view v-if="isRejected(task)" class="small-button danger" @tap="appealTask(task)">发起申诉</view>
            </view>
          </template>
        </view>
        <view v-if="!loading && rows.length === 0" class="card card-empty"><EmptyState icon="target" title="暂无任务" /></view>
      </template>
    </template>

    <template v-else-if="submitFor">
      <view class="card">
        <view class="row between">
          <text class="task-title">{{ submitFor.title || submitFor.name }}</text>
          <text class="pill blue">进行中</text>
        </view>
        <text v-if="describe(submitFor)" class="task-desc">{{ describe(submitFor) }}</text>
        <view v-if="deadlineOf(submitFor)" class="task-deadline-line">
          <AppIcon name="clock" :size="24" color="amber" />
          <text>截止时间：{{ deadlineOf(submitFor) }}</text>
        </view>
      </view>

      <view class="card">
        <view class="field-label"><text class="field-required">*</text>成果说明</view>
        <textarea
          v-model="resultText"
          class="textarea result-textarea"
          placeholder="请说明完成情况、成果与影响…"
          placeholder-class="placeholder-gray"
        />
        <view class="field-label image-label">佐证图片 <text class="field-optional">（最多 9 张，随成果一起提交）</text></view>
        <view class="image-grid">
          <view v-for="(img, index) in resultImages" :key="img" class="image-item">
            <image class="image-preview" :src="img" mode="aspectFill" @tap="removeImage(index)" />
          </view>
          <view v-if="resultImages.length < 6" class="image-add" @tap="chooseImage">
            <AppIcon name="image" :size="48" color="faint" />
            <text class="image-add-text">继续上传</text>
          </view>
        </view>
        <text class="muted image-note">佐证图将先上传再随成果提交给管理员审核。</text>
        <view class="draft-row">
          <view class="draft-link" @tap="saveDraft"><AppIcon name="save" :size="24" color="muted" /><text>保存草稿</text></view>
        </view>
      </view>

      <view class="notice-amber">
        <AppIcon name="clock" :size="28" color="amber" />
        <text>提交后进入审核，审核期间不可修改。</text>
      </view>

      <view class="button submit-button" :class="{ disabled: submitting }" @tap="submit">{{ submitting ? '提交中…' : '提交审核' }}</view>
    </template>

    <AppTabBar />

    <view v-if="detailFor" class="mask" @tap="detailFor = null">
      <view class="dialog" @tap.stop>
        <view class="row between">
          <text class="task-title">{{ detailFor.title || detailFor.name }}</text>
          <text class="pill" :class="statusPill(detailFor).cls">{{ statusPill(detailFor).text }}</text>
        </view>
        <text v-if="describe(detailFor)" class="task-desc">{{ describe(detailFor) }}</text>
        <text v-if="detailFor.result || detailFor.submitContent" class="task-desc">成果：{{ detailFor.result || detailFor.submitContent }}</text>
        <view class="task-meta">
          <view class="task-reward"><AppIcon name="gift" :size="26" color="brand" /><text>+{{ rewardOf(detailFor) }} 积分</text></view>
          <view v-if="deadlineOf(detailFor)" class="task-deadline"><AppIcon name="calendar" :size="24" color="muted" /><text>截至 {{ deadlineOf(detailFor) }}</text></view>
        </view>
        <view class="button ghost dialog-close-button" @tap="detailFor = null">知道了</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20rpx 4rpx 16rpx;
}

.list-head-text {
  font-size: 24rpx;
  color: var(--ink-3);
}

.list-head-sort {
  font-size: 24rpx;
  color: var(--ink-3);
}

.list-head-sort:active {
  opacity: 0.6;
}

.task-card {
  padding: 28rpx;
}

.task-title {
  flex: 1;
  min-width: 0;
  margin-right: 16rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: var(--ink-3);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.task-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;
}

.task-reward {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--amber);
}

.task-deadline {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  font-size: 22rpx;
  color: var(--muted);
}

.task-deadline-line {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: var(--amber);
}

.task-button {
  margin-top: 24rpx;
  height: 84rpx;
  line-height: 84rpx;
}

.task-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 24rpx;
}

.field-label {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--ink);
}

.field-required {
  color: var(--red);
  margin-right: 6rpx;
}

.field-optional {
  font-size: 22rpx;
  font-weight: 400;
  color: var(--muted);
}

.result-textarea {
  min-height: 220rpx;
}

.image-label {
  margin-top: 28rpx;
}

.image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 16rpx;
}

.image-item {
  width: 152rpx;
  height: 152rpx;
  border-radius: 16rpx;
  overflow: hidden;
}

.image-preview {
  width: 100%;
  height: 100%;
  display: block;
}

.image-add {
  width: 152rpx;
  height: 152rpx;
  border: 2rpx dashed #c9cfd8;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  background: #fafbfc;
  box-sizing: border-box;
}

.image-add:active {
  opacity: 0.7;
}

.image-add-icon {
  font-size: 40rpx;
}

.image-add-text {
  font-size: 22rpx;
  color: var(--muted);
}

.image-note {
  display: block;
  margin-top: 16rpx;
}

.draft-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 16rpx;
}

.draft-link {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  font-size: 24rpx;
  color: var(--brand);
}

.draft-link:active {
  opacity: 0.6;
}

.notice-amber {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: var(--amber-soft);
  color: #b45309;
  font-size: 24rpx;
}

.notice-amber-icon {
  font-size: 26rpx;
}

.submit-button {
  margin-top: 32rpx;
}

/* ── 骨架占位 ── */
.sk-line {
  height: 28rpx;
}

.sk-task-desc {
  margin-top: 20rpx;
}

.w20 { width: 20%; }
.w40 { width: 40%; }
.w64 { width: 64%; }

.dialog {
  width: 620rpx;
  padding: 32rpx;
  border-radius: 28rpx;
  background: var(--surface);
}

.dialog-close-button {
  margin-top: 28rpx;
  height: 80rpx;
  line-height: 80rpx;
}
</style>
