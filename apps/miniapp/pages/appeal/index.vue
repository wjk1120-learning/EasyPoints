<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createAppeal } from '../../api/appeal/appeal'
import { uploadImage } from '../../api/upload/upload'
import { formatTime } from '../../utils/format'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AppIcon from '../../components/AppIcon.vue'

/** 申诉目标（契约 7.1）：point_record / task_claim / order / point_application */
const targetType = ref('point_record')
const targetId = ref<number | string>('')
const targetLabel = ref('积分明细')
const originalRemark = ref('')
const originalPoints = ref(0)
const originalTime = ref('')
const reason = ref('')
const reasonError = ref(false)
const images = ref<string[]>([])
const uploading = ref(false)
let triedSubmit = false

const TARGET_LABELS: Record<string, string> = {
  point_record: '积分明细',
  order: '兑换订单',
  task_claim: '任务',
  point_application: '积分申请'
}

/** 关联事项分段展示：消息摘要按后端拼接约定「；」分行、「：」拆「标签+内容」；自由备注拆不出结构则整段一行 */
const relatedSegments = computed(() =>
  originalRemark.value
    .split('；')
    .map((seg) => seg.trim())
    .filter(Boolean)
)

onLoad((query) => {
  const safeQuery = query || {}
  // 新口径 targetType/targetId；兼容明细页旧入口 recordId（=point_record 流水申诉）
  targetType.value = safeQuery.targetType || 'point_record'
  targetId.value = safeQuery.targetId || safeQuery.recordId || ''
  targetLabel.value = TARGET_LABELS[targetType.value] || '关联事项'
  originalRemark.value = decodeURIComponent(safeQuery.remark || '')
  originalPoints.value = Number(safeQuery.points || 0)
  originalTime.value = decodeURIComponent(safeQuery.time || '')
})

function onReasonInput() {
  if (triedSubmit) reasonError.value = !reason.value.trim()
}

function chooseImage() {
  const left = 6 - images.value.length
  if (left <= 0) {
    uni.showToast({ title: '最多上传 6 张', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: left,
    success(res) {
      images.value = images.value.concat(res.tempFilePaths || []).slice(0, 6)
    }
  })
}

function removeImage(index: number) {
  images.value = images.value.filter((item, i) => i !== index)
}

async function submit() {
  triedSubmit = true
  if (!reason.value.trim()) {
    reasonError.value = true
    uni.showToast({ title: '请填写申诉理由', icon: 'none' })
    return
  }
  if (uploading.value) return
  uploading.value = true
  try {
    // 佐证图先过上传接口（11.9），再随申诉提交（契约 7.1 evidenceImages）
    const urls: string[] = []
    for (const img of images.value) urls.push(await uploadImage(img))
    await createAppeal({
      targetType: targetType.value,
      targetId: targetId.value,
      reason: reason.value.trim(),
      ...(urls.length ? { evidenceImages: urls } : {})
    })
    uni.showToast({ title: '申诉已提交' })
    uni.navigateBack()
  } catch (error) {
    uni.showToast({
      title: (error as Error)?.message || '提交失败',
      icon: 'none'
    })
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="发起申诉" />

    <view class="card">
      <text class="muted">关联事项 · {{ targetLabel }}</text>
      <view v-if="relatedSegments.length" class="related-list">
        <view v-for="seg in relatedSegments" :key="seg" class="related-item">
          <text v-if="seg.includes('：')" class="related-key">{{ seg.slice(0, seg.indexOf('：')) }}</text>
          <text class="related-value">{{ seg.includes('：') ? seg.slice(seg.indexOf('：') + 1) : seg }}</text>
        </view>
      </view>
      <text v-else class="related-title">未提供事项信息</text>
      <view v-if="originalTime || originalPoints" class="row between related-meta">
        <text v-if="originalTime" class="muted">{{ formatTime(originalTime) }}</text>
        <text v-if="originalPoints" class="related-points" :class="originalPoints > 0 ? 'pos' : 'neg'">
          {{ originalPoints > 0 ? '+' : '' }}{{ originalPoints }} 积分
        </text>
      </view>
    </view>

    <view class="card">
      <view class="field-label"><text class="field-required">*</text>申诉理由</view>
      <textarea
        v-model="reason"
        class="textarea appeal-textarea"
        :class="{ 'textarea-error': reasonError }"
        placeholder="请说明申诉原因、期望的处理结果…"
        placeholder-class="placeholder-gray"
        @input="onReasonInput"
      />
      <view v-if="reasonError" class="error-text"><text class="error-icon">ⓘ</text>申诉理由不能为空</view>
    </view>

    <view class="card">
      <view class="field-label">佐证图片 <text class="field-optional">（选填）</text></view>
      <view class="image-grid">
        <view v-for="(img, index) in images" :key="img" class="image-item">
          <image class="image-preview" :src="img" mode="aspectFill" @tap="removeImage(index)" />
        </view>
        <view v-if="images.length < 6" class="image-add" @tap="chooseImage">
          <AppIcon name="image" :size="48" color="faint" />
          <text class="image-add-text">{{ images.length > 0 ? '继续上传' : '上传图片' }}</text>
        </view>
      </view>
      <text class="muted image-note">图片将随申诉一并上传提交，最多 6 张。</text>
    </view>

    <view class="safe-note">
      <AppIcon name="shield" :size="28" color="green" />
      <text>申诉提交后不可撤回，处理结果将通过通知中心发送。</text>
    </view>

    <view class="button submit-button" @tap="submit">提交申诉</view>

    <AppTabBar />
  </view>
</template>

<style scoped>
/* 参数表风格：标签列固定宽对齐、值列正常字重，整卡只突出内容本身 */
.related-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 16rpx;
}

.related-item {
  display: flex;
  align-items: baseline;
}

.related-key {
  flex-shrink: 0;
  width: 150rpx;
  font-size: 26rpx;
  color: var(--muted);
}

.related-value {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  line-height: 1.55;
  color: var(--ink);
  word-break: break-all;
}

.related-title {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  line-height: 1.55;
  color: var(--ink);
}

.related-meta {
  margin-top: 14rpx;
}

.related-points {
  flex-shrink: 0;
  font-size: 28rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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

.appeal-textarea {
  min-height: 220rpx;
}

.error-icon {
  font-size: 24rpx;
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

.safe-note {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  padding: 8rpx 8rpx 0;
  color: var(--ink-3);
  font-size: 24rpx;
  line-height: 1.6;
}

.safe-note-icon {
  font-size: 26rpx;
}

.submit-button {
  margin-top: 32rpx;
}
</style>
