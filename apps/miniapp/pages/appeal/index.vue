<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request } from '../../api'
import NavBar from '../../components/NavBar.vue'

const pointRecordId = ref('')
const originalRemark = ref('')
const originalPoints = ref(0)
const originalTime = ref('')
const reason = ref('')
const reasonError = ref(false)
const images = ref([])
let triedSubmit = false

onLoad((query) => {
  const safeQuery = query || {}
  pointRecordId.value = safeQuery.recordId || ''
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

function removeImage(index) {
  images.value = images.value.filter((item, i) => i !== index)
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

async function submit() {
  triedSubmit = true
  if (!reason.value.trim()) {
    reasonError.value = true
    uni.showToast({ title: '请填写申诉理由', icon: 'none' })
    return
  }
  try {
    await request('/miniapp/appeals', {
      method: 'POST',
      data: {
        pointRecordId: pointRecordId.value,
        reason: reason.value
      }
    })
    uni.showToast({ title: '申诉已提交' })
    uni.navigateBack()
  } catch (error) {
    uni.showToast({
      title: error?.message || '提交失败',
      icon: 'none'
    })
  }
}
</script>

<template>
  <view class="page page-nav">
    <NavBar title="发起申诉" />

    <view class="card">
      <text class="muted">关联事项 · 积分明细</text>
      <view class="row between related-row">
        <text class="related-title">{{ originalRemark || '积分流水' }}</text>
      </view>
      <view class="row between">
        <text class="muted">{{ formatTime(originalTime) }}</text>
        <text class="related-points" :class="originalPoints > 0 ? 'pos' : 'neg'">
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
          <text class="image-add-icon">🖼️</text>
          <text class="image-add-text">{{ images.length > 0 ? '继续上传' : '上传图片' }}</text>
        </view>
      </view>
      <text class="muted image-note">附件暂不随申诉提交，待后端上传接口就绪后开放。</text>
    </view>

    <view class="safe-note">
      <text class="safe-note-icon">🛡️</text>
      <text>申诉提交后不可撤回，处理结果将通过通知中心发送。</text>
    </view>

    <view class="button submit-button" @tap="submit">✈ 提交申诉</view>
  </view>
</template>

<style scoped>
.related-row {
  margin-top: 16rpx;
}

.related-title {
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

.related-points {
  flex-shrink: 0;
  font-size: 28rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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
  color: #9aa1ab;
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
  color: #6b7280;
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
