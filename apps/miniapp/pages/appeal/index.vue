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
      <view class="row between">
        <text class="muted">原记录备注</text>
      </view>
      <text style="margin-top: 12rpx; display: block">{{ originalRemark }}</text>
    </view>
    <view class="card">
      <view class="row between">
        <text class="muted">申诉原因</text>
      </view>
      <textarea class="textarea" placeholder="请输入申诉原因..." v-model="reason"></textarea>
    </view>
    <view class="button" @tap="submit">提交</view>
  </view>
</template>

<style scoped>
.textarea {
  width: 100%;
  min-height: 160rpx;
  margin-top: 12rpx;
  padding: 12rpx 16rpx;
  box-sizing: border-box;
  background: #f8fafc;
  border-radius: 8rpx;
  display: block;
}
</style>
