<script setup>
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { isMissingApi, request } from '../../api'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'

const tab = ref('all')
const view = ref('list')
const rows = ref([])
const missing = ref('')
const loading = ref(false)
const sortByReward = ref(true)
const submitFor = ref(null)
const resultText = ref('')
const resultImages = ref([])
const detailFor = ref(null)

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

onShow(load)
onPullDownRefresh(async () => {
  await load()
  uni.stopPullDownRefresh()
})

async function load() {
  loading.value = true
  missing.value = ''
  try {
    const path = tab.value === 'mine' ? '/miniapp/tasks?scope=mine' : '/miniapp/tasks?scope=all'
    const data = await request(path)
    rows.value = Array.isArray(data) ? data : []
  } catch (error) {
    rows.value = []
    missing.value = isMissingApi(error)
      ? '任务接口尚未提供。约定：GET /miniapp/tasks?scope=all|mine，POST /miniapp/tasks/{id}/claim，POST /miniapp/tasks/{id}/submit { content }。'
      : (error?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function switchTab(next) {
  tab.value = next
  view.value = 'list'
  submitFor.value = null
  load()
}

function toggleSort() {
  sortByReward.value = !sortByReward.value
}

function isClaimable(task) {
  return task.status === 'open' || Boolean(task.claimable)
}

function isRunning(task) {
  return task.status === 'in_progress' || Boolean(task.canSubmit)
}

function isReviewing(task) {
  return ['pending_review', 'submitted', 'reviewing'].includes(String(task.status || ''))
}

function isApproved(task) {
  return ['approved', 'passed', 'completed'].includes(String(task.status || ''))
}

function isRejected(task) {
  return ['rejected', 'refused'].includes(String(task.status || ''))
}

function isHistory(task) {
  return ['history', 'archived', 'expired', 'closed'].includes(String(task.status || ''))
}

function statusPill(task) {
  if (isClaimable(task)) return { text: '可领取', cls: 'blue' }
  if (isRunning(task)) return { text: '进行中', cls: 'blue' }
  if (isReviewing(task)) return { text: '待审核', cls: 'amber' }
  if (isApproved(task)) return { text: '审核通过', cls: 'green' }
  if (isRejected(task)) return { text: '已驳回', cls: 'red' }
  if (isHistory(task)) return { text: '历史任务', cls: '' }
  return { text: task.statusText || task.status || '进行中', cls: '' }
}

function rewardOf(task) {
  const value = task.rewardPoints ?? task.points
  return value == null ? '-' : Number(value)
}

function deadlineOf(task) {
  const value = task.deadline || task.dueAt || task.deadlineAt
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${m}-${d}`
}

async function claim(task) {
  try {
    await request(`/miniapp/tasks/${task.id}/claim`, { method: 'POST' })
    uni.showToast({ title: '已领取' })
    await load()
  } catch (error) {
    uni.showToast({ title: error?.message || '领取失败', icon: 'none' })
  }
}

function openSubmit(task) {
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
  const left = 6 - resultImages.value.length
  if (left <= 0) {
    uni.showToast({ title: '最多上传 6 张', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: left,
    success(res) {
      resultImages.value = resultImages.value.concat(res.tempFilePaths || []).slice(0, 6)
    }
  })
}

function removeImage(index) {
  resultImages.value = resultImages.value.filter((item, i) => i !== index)
}

async function submit() {
  const content = resultText.value.trim()
  if (!content) {
    uni.showToast({ title: '请填写成果说明', icon: 'none' })
    return
  }
  try {
    await request(`/miniapp/tasks/${submitFor.value.id}/submit`, { method: 'POST', data: { content } })
    uni.removeStorageSync(`taskDraft:${submitFor.value.id}`)
    submitFor.value = null
    resultText.value = ''
    resultImages.value = []
    view.value = 'list'
    uni.showToast({ title: '已提交，等待审核' })
    await load()
  } catch (error) {
    uni.showToast({ title: error?.message || '提交失败', icon: 'none' })
  }
}

function openDetail(task) {
  detailFor.value = task
}

function appealHint() {
  uni.showModal({
    title: '发起申诉',
    content: '申诉需绑定本人积分流水，请在「积分明细」中选择对应记录后发起。',
    confirmText: '去明细',
    success(res) {
      if (res.confirm) uni.switchTab({ url: '/pages/points/index' })
    }
  })
}

function describe(task) {
  return task.description || task.summary || ''
}
</script>

<template>
  <view class="page page-tab page-nav">
    <NavBar
      :title="view === 'submit' ? '提交成果' : '任务大厅'"
      :back="view === 'submit'"
      @back="view = 'list'"
    />

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
        <view v-for="task in sortedRows" :key="task.id" class="card task-card">
          <view class="row between">
            <text class="task-title">{{ task.title || task.name }}</text>
            <text class="pill" :class="statusPill(task).cls">{{ statusPill(task).text }}</text>
          </view>
          <text v-if="describe(task)" class="task-desc">{{ describe(task) }}</text>
          <view class="task-meta">
            <text class="task-reward">🎁 +{{ rewardOf(task) }} 积分</text>
            <text v-if="deadlineOf(task)" class="task-deadline">📅 截至 {{ deadlineOf(task) }}</text>
          </view>

          <template v-if="tab === 'all'">
            <view v-if="isClaimable(task)" class="button task-button" @tap="claim(task)">领取任务</view>
          </template>
          <template v-else>
            <view v-if="isClaimable(task)" class="button task-button" @tap="claim(task)">领取任务</view>
            <view v-else class="task-actions">
              <view v-if="isRunning(task)" class="small-button" @tap="openSubmit(task)">提交成果</view>
              <view v-if="isReviewing(task)" class="small-button ghost" @tap="openDetail(task)">查看成果</view>
              <view v-if="isApproved(task) || isHistory(task)" class="small-button ghost" @tap="openDetail(task)">查看详情</view>
              <view v-if="isRejected(task)" class="small-button danger" @tap="appealHint">发起申诉</view>
            </view>
          </template>
        </view>
        <view v-if="!loading && rows.length === 0" class="card card-empty"><text class="muted">暂无任务</text></view>
      </template>
    </template>

    <template v-else-if="submitFor">
      <view class="card">
        <view class="row between">
          <text class="task-title">{{ submitFor.title || submitFor.name }}</text>
          <text class="pill blue">进行中</text>
        </view>
        <text v-if="describe(submitFor)" class="task-desc">{{ describe(submitFor) }}</text>
        <text v-if="deadlineOf(submitFor)" class="task-deadline-line">⏱ 截止时间：{{ deadlineOf(submitFor) }}</text>
      </view>

      <view class="card">
        <view class="field-label"><text class="field-required">*</text>成果说明</view>
        <textarea
          v-model="resultText"
          class="textarea result-textarea"
          placeholder="请说明完成情况、成果与影响…"
          placeholder-class="placeholder-gray"
        />
        <view class="field-label image-label">佐证图片 <text class="field-optional">（最多 6 张）</text></view>
        <view class="image-grid">
          <view v-for="(img, index) in resultImages" :key="img" class="image-item">
            <image class="image-preview" :src="img" mode="aspectFill" @tap="removeImage(index)" />
          </view>
          <view v-if="resultImages.length < 6" class="image-add" @tap="chooseImage">
            <text class="image-add-icon">🖼️</text>
            <text class="image-add-text">继续上传</text>
          </view>
        </view>
        <text class="muted image-note">附件暂不随成果提交，待后端上传接口就绪后开放。</text>
        <view class="draft-row">
          <text class="draft-link" @tap="saveDraft">💾 保存草稿</text>
        </view>
      </view>

      <view class="notice-amber">
        <text class="notice-amber-icon">⏱</text>
        <text>提交后进入审核，审核期间不可修改。</text>
      </view>

      <view class="button submit-button" @tap="submit">✈ 提交审核</view>
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
          <text class="task-reward">🎁 +{{ rewardOf(detailFor) }} 积分</text>
          <text v-if="deadlineOf(detailFor)" class="task-deadline">📅 截至 {{ deadlineOf(detailFor) }}</text>
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
  color: #6b7280;
}

.list-head-sort {
  font-size: 24rpx;
  color: #6b7280;
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
  color: #1a2233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #6b7280;
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
  font-size: 26rpx;
  font-weight: 600;
  color: #d97706;
}

.task-deadline {
  font-size: 22rpx;
  color: #9aa1ab;
}

.task-deadline-line {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #d97706;
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
  color: #1a2233;
}

.field-required {
  color: #f04438;
  margin-right: 6rpx;
}

.field-optional {
  font-size: 22rpx;
  font-weight: 400;
  color: #9aa1ab;
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
  color: #9aa1ab;
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
  font-size: 24rpx;
  color: #2f6bff;
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
  background: #fff6e8;
  color: #b45309;
  font-size: 24rpx;
}

.notice-amber-icon {
  font-size: 26rpx;
}

.submit-button {
  margin-top: 32rpx;
}

.dialog {
  width: 620rpx;
  padding: 32rpx;
  border-radius: 28rpx;
  background: #ffffff;
}

.dialog-close-button {
  margin-top: 28rpx;
  height: 80rpx;
  line-height: 80rpx;
}
</style>
