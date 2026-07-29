<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request } from '../../api'

const pointRecordId = ref('')
const originalRemark = ref('')
const reason = ref('')

onLoad((query) => {
  const safeQuery = query || {}
  pointRecordId.value = safeQuery.recordId || ''
  originalRemark.value = decodeURIComponent(safeQuery.remark || '')
})

async function submit() {
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
  <view class="page">
    <view class="card">
      <text class="section-label">原记录备注</text>
      <text class="remark-text">{{ originalRemark }}</text>
    </view>
    <view class="card">
      <text class="section-label">申诉原因</text>
      <textarea class="textarea" placeholder="请详细描述申诉原因..." v-model="reason"></textarea>
    </view>
    <view class="button" @tap="submit">提交申诉</view>
  </view>
</template>

<style scoped>
.remark-text {
  display: block;
  margin-top: 12rpx;
  font-size: 28rpx;
  line-height: 1.65;
  color: #3a3a3c;
  padding: 20rpx 24rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.5);
  border: 1rpx solid rgba(91, 155, 213, 0.1);
}
</style>
