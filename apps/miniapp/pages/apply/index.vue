<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { fetchApplications, createApplication } from '../../api/application/application'
import type { PointApplication } from '../../api/application/types'
import { uploadImage } from '../../api/upload/upload'
import { formatTime } from '../../utils/format'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

type FilterKey = 'all' | 'pending' | 'passed' | 'rejected'

const view = ref<'form' | 'mine'>('form')
const points = ref('')
const description = ref('')
const pointsTouched = ref(false)
const descriptionTouched = ref(false)
const rows = ref<PointApplication[]>([])
const filter = ref<FilterKey>('all')
const images = ref<string[]>([])
const submitting = ref(false)

const pointsValue = computed(() => Number(points.value))
const pointsEmpty = computed(() => String(points.value).trim() === '')
const pointsInvalid = computed(() => !pointsEmpty.value && (!Number.isFinite(pointsValue.value) || pointsValue.value <= 0))
const pointsNegative = computed(() => Number.isFinite(pointsValue.value) && pointsValue.value < 0)
const descriptionEmpty = computed(() => !description.value.trim())
const formValid = computed(() => !pointsEmpty.value && !pointsInvalid.value && !descriptionEmpty.value)

const visibleRows = computed(() => {
  if (filter.value === 'pending') return rows.value.filter((item) => !isDone(item))
  if (filter.value === 'passed') return rows.value.filter((item) => /approved|通过/.test(`${item.status || ''}${item.statusText || ''}`))
  if (filter.value === 'rejected') return rows.value.filter((item) => /rejected|驳回/.test(`${item.status || ''}${item.statusText || ''}`))
  return rows.value
})

// 消息详情「发起申诉」降级入口带 view=mine：直接落到「我的申请」
onLoad((query) => {
  if (query?.view === 'mine') view.value = 'mine'
})

onShow(loadMine)

async function loadMine() {
  try {
    const page = await fetchApplications({ page: 1, pageSize: 50 })
    rows.value = page.data
  } catch (error) {
    rows.value = []
    uni.showToast({ title: (error as Error)?.message || '加载失败', icon: 'none' })
  }
}

function switchView(next: 'form' | 'mine') {
  view.value = next
}

function onPointsBlur() {
  pointsTouched.value = true
}

function onDescriptionBlur() {
  descriptionTouched.value = true
}

function chooseImage() {
  const left = 9 - images.value.length
  if (left <= 0) {
    uni.showToast({ title: '最多上传 9 张', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: left,
    success(res) {
      images.value = images.value.concat(res.tempFilePaths || []).slice(0, 9)
    }
  })
}

function removeImage(index: number) {
  images.value = images.value.filter((item, i) => i !== index)
}

async function submit() {
  pointsTouched.value = true
  descriptionTouched.value = true
  if (!formValid.value || submitting.value) return
  submitting.value = true
  try {
    // 佐证图先上传（契约 11.9）再随申请提交（6.1 evidenceImages ≤9）
    const urls: string[] = []
    for (const path of images.value) {
      urls.push(await uploadImage(path))
    }
    await createApplication({ points: pointsValue.value, description: description.value.trim(), evidenceImages: urls })
    points.value = ''
    description.value = ''
    images.value = []
    pointsTouched.value = false
    descriptionTouched.value = false
    uni.showToast({ title: '已提交，等待审核' })
    view.value = 'mine'
    await loadMine()
  } catch (error) {
    uni.showToast({ title: (error as Error)?.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function isDone(item: PointApplication) {
  return /approved|rejected|通过|驳回/.test(`${item.status || ''}${item.statusText || ''}`)
}

function statusPill(item: PointApplication) {
  const text = `${item.status || ''}${item.statusText || ''}`
  if (/approved|通过/.test(text)) return { label: '已通过', cls: 'green' }
  if (/rejected|驳回/.test(text)) return { label: '已驳回', cls: 'red' }
  return { label: item.statusText || '待审核', cls: 'amber' }
}

function statusLine(item: PointApplication) {
  const text = `${item.status || ''}${item.statusText || ''}`
  if (/approved|通过/.test(text)) return `积分已于 ${formatTime(item.updatedAt || item.createdAt)} 入账`
  if (/rejected|驳回/.test(text)) return ''
  return '预计 3 个工作日内完成审核'
}

function rejectReason(item: PointApplication) {
  return item.reviewRemark || '如有疑问请联系积分管理员'
}

/** 被驳回申请直达申诉页（PRD 4.6；targetType=point_application，契约 7.1） */
function appealApplication(item: PointApplication) {
  const query = [
    'targetType=point_application',
    `targetId=${item.id}`,
    `remark=${encodeURIComponent(item.reason || '')}`,
    `points=${item.points ?? 0}`,
    `time=${encodeURIComponent(item.updatedAt || '')}`
  ].join('&')
  uni.navigateTo({ url: `/pages/appeal/index?${query}` })
}

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'passed', label: '已通过' },
  { key: 'rejected', label: '已驳回' }
]
</script>

<template>
  <view class="page page-nav">
    <NavBar :title="view === 'form' ? '积分申请' : '我的申请'" />

    <view class="segmented">
      <text class="tab" :class="{ active: view === 'form' }" @tap="switchView('form')">积分申请</text>
      <text class="tab" :class="{ active: view === 'mine' }" @tap="switchView('mine')">我的申请</text>
    </view>

    <template v-if="view === 'form'">
      <view class="card card-info intro">
        <AppIcon name="lightbulb" :size="30" color="amber" />
        <text class="intro-text">用于申请未被任务覆盖的突出贡献积分。提交后进入部门管理员审核。</text>
      </view>

      <view class="card">
        <view class="field-label"><text class="field-required">*</text>申请分值</view>
        <view class="field-row" :class="{ 'field-row-error': pointsTouched && (pointsEmpty || pointsInvalid) }">
          <input
            v-model="points"
            class="field-input"
            type="number"
            placeholder="请输入正整数"
            placeholder-class="placeholder-gray"
            @blur="onPointsBlur"
          />
          <text class="field-suffix">积分</text>
        </view>
        <view v-if="pointsTouched && pointsEmpty" class="error-text"><text class="error-icon">ⓘ</text>申请分值不能为空</view>
        <view v-if="pointsNegative" class="form-warn"><AppIcon name="alert-triangle" :size="24" color="red" /><text>申请分值不能为负数</text></view>
        <view v-else-if="pointsTouched && pointsInvalid" class="error-text"><text class="error-icon">ⓘ</text>申请分值需为正整数</view>

        <view class="field-label desc-label"><text class="field-required">*</text>贡献描述</view>
        <textarea
          v-model="description"
          class="textarea apply-textarea"
          :class="{ 'textarea-error': descriptionTouched && descriptionEmpty }"
          placeholder="请说明贡献背景、过程与结果…"
          placeholder-class="placeholder-gray"
          @blur="onDescriptionBlur"
        />
        <view v-if="descriptionTouched && descriptionEmpty" class="error-text"><text class="error-icon">ⓘ</text>贡献描述不能为空</view>

        <view class="field-label image-label">佐证图片 <text class="field-optional">（选填）</text></view>
        <view class="image-grid">
          <view v-for="(img, index) in images" :key="img" class="image-item">
            <image class="image-preview" :src="img" mode="aspectFill" @tap="removeImage(index)" />
          </view>
          <view v-if="images.length < 6" class="image-add" @tap="chooseImage">
            <AppIcon name="image" :size="48" color="faint" />
            <text class="image-add-text">{{ images.length > 0 ? '继续上传' : '上传图片' }}</text>
          </view>
        </view>
        <text class="muted image-note">佐证图将先上传再随申请提交给管理员审核。</text>
      </view>

      <view class="card">
        <view class="block-title">审核流程</view>
        <view class="steps">
          <view class="step">
            <view class="step-num">1</view>
            <text class="step-label">提交申请</text>
          </view>
          <view class="step-line" />
          <view class="step">
            <view class="step-num">2</view>
            <text class="step-label">部门审核</text>
          </view>
          <view class="step-line" />
          <view class="step">
            <view class="step-num">3</view>
            <text class="step-label">积分入账</text>
          </view>
        </view>
      </view>

      <view class="button" :class="{ disabled: !formValid }" @tap="submit">
        {{ formValid ? '提交申请' : '请完善必填信息' }}
      </view>
      <text class="submit-note">提交成功后状态为「待审核」</text>
    </template>

    <template v-else>
      <view class="chips">
        <text
          v-for="item in filters"
          :key="item.key"
          class="chip"
          :class="{ 'chip-on': filter === item.key }"
          @tap="filter = item.key"
        >{{ item.label }}</text>
      </view>

      <template v-if="view === 'mine'">
        <view v-for="item in visibleRows" :key="item.id" class="card apply-card">
          <view class="row between">
            <text class="apply-title">{{ item.reason }}</text>
            <text class="pill" :class="statusPill(item).cls">{{ statusPill(item).label }}</text>
          </view>
          <view class="row between apply-meta">
            <text class="muted">{{ formatTime(item.createdAt) }}</text>
            <text class="apply-points">+{{ item.points }}</text>
          </view>
          <text v-if="statusLine(item)" class="muted apply-status">{{ statusLine(item) }}</text>
          <view v-if="/rejected|驳回/.test(`${item.status || ''}${item.statusText || ''}`)" class="reject-row">
            <text class="reject-reason">原因：{{ rejectReason(item) }}</text>
            <view class="small-button" @tap="appealApplication(item)">发起申诉</view>
          </view>
        </view>
        <view v-if="visibleRows.length === 0" class="card card-empty"><EmptyState icon="file-text" title="暂无申请" /></view>
        <view v-if="visibleRows.length > 0" class="list-footer">已展示全部申请记录</view>
      </template>
    </template>

    <AppTabBar />
  </view>
</template>

<style scoped>
.intro {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 24rpx 28rpx;
  margin-top: 20rpx;
}

.chips {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
  margin-bottom: 16rpx;
}

.chip {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background: var(--surface);
  color: var(--ink-3);
  font-size: 24rpx;
}

.chip-on {
  background: var(--brand);
  color: var(--surface);
}

.intro-icon {
  font-size: 28rpx;
  line-height: 1.5;
}

.intro-text {
  flex: 1;
  font-size: 24rpx;
  color: #4a6899;
  line-height: 1.6;
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

.field-row {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
  padding: 0 24rpx;
  height: 88rpx;
  background: var(--field);
  border: 1rpx solid var(--line);
  border-radius: 16rpx;
  box-sizing: border-box;
}

.field-row-error {
  border-color: var(--red);
  background: #fffafa;
}

.field-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  font-size: 28rpx;
  color: var(--ink);
}

.field-suffix {
  font-size: 26rpx;
  color: var(--muted);
}

.error-text {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 12rpx;
  color: var(--red);
  font-size: 24rpx;
}

.error-icon {
  font-size: 24rpx;
}

.form-warn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  background: var(--red-soft);
  color: var(--red);
  font-size: 24rpx;
}

.desc-label {
  margin-top: 32rpx;
}

.apply-textarea {
  min-height: 200rpx;
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

.block-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--ink);
}

.steps {
  display: flex;
  align-items: center;
  margin-top: 28rpx;
  padding: 0 12rpx;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.step-num {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: var(--brand);
  color: var(--surface);
  font-size: 24rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-label {
  font-size: 22rpx;
  color: var(--ink-3);
}

.step-line {
  flex: 1;
  height: 2rpx;
  margin: 0 12rpx 34rpx;
  background: #dfe6ff;
}

.button.disabled {
  background: var(--line);
  color: var(--faint);
}

.submit-note {
  display: block;
  text-align: center;
  margin-top: 16rpx;
  font-size: 22rpx;
  color: var(--faint);
}

.apply-card {
  padding: 26rpx 28rpx;
}

.apply-title {
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

.apply-meta {
  margin-top: 12rpx;
}

.apply-points {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--brand);
  font-variant-numeric: tabular-nums;
}

.apply-status {
  display: block;
  margin-top: 8rpx;
}

.reject-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 14rpx;
}

.reject-reason {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: var(--red);
  line-height: 1.5;
}

.list-footer {
  text-align: center;
  padding: 8rpx 0;
  font-size: 22rpx;
  color: var(--faint);
}
</style>
