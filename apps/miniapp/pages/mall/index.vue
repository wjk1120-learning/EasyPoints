<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getApiBase, request } from '../../api'

const gifts = ref([])
const apiBase = getApiBase()

onShow(async () => {
  try {
    gifts.value = await request('/miniapp/mall/gifts')
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  }
})

async function redeem(gift) {
  const confirmed = await new Promise((resolve) => {
    uni.showModal({
      title: '确认兑换',
      content: `确认兑换「${gift?.name || ''}」？\n将扣除 ${gift?.pointsCost ?? '-'} 积分，提交后需等待审核。`,
      confirmText: '确认兑换',
      cancelText: '取消',
      success(res) {
        resolve(Boolean(res.confirm))
      },
      fail() {
        resolve(false)
      }
    })
  })
  if (!confirmed) return
  try {
    await request('/miniapp/orders', {
      method: 'POST',
      data: { giftId: gift.id }
    })
    uni.showToast({ title: '兑换申请已提交' })
  } catch (error) {
    uni.showToast({
      title: error?.message || '兑换失败',
      icon: 'none'
    })
  }
}
</script>

<template>
  <view class="page">
    <view v-for="gift in gifts" :key="gift.id" class="card">
      <view class="row">
        <view v-if="gift.coverImageUrl" class="cover">
          <image :src="apiBase + gift.coverImageUrl" mode="aspectFill" class="cover-image" />
        </view>
        <view class="info">
          <view class="row between">
            <text style="font-weight: 500">{{ gift.name }}</text>
            <text style="font-weight: 600; color: #00a870">
              {{ gift.pointsCost }} 积分
            </text>
          </view>
          <view class="row between" style="margin-top: 12rpx">
            <text class="muted">库存：{{ gift.stock }}</text>
            <view class="small-button" @tap="redeem(gift)">立即兑换</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.cover {
  width: 160rpx;
  height: 160rpx;
  background: #f0f0f0;
  border-radius: 8rpx;
  overflow: hidden;
  margin-right: 20rpx;
}

.cover-image {
  width: 100%;
  height: 100%;
  display: block;
}

.small-button {
  min-width: 140rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: 8rpx;
  background: #1677ff;
  color: #fff;
  text-align: center;
  padding: 0 18rpx;
}
</style>
