<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getApiBase, request } from '../../api'
import AiFloatBall from '../../components/AiFloatBall.vue'

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
  <view class="page page-tab">
    <view v-for="gift in gifts" :key="gift.id" class="card gift-card">
      <view class="row">
        <view v-if="gift.coverImageUrl" class="gift-cover">
          <image :src="apiBase + gift.coverImageUrl" mode="aspectFill" class="gift-cover-image" />
        </view>
        <view v-else class="gift-cover gift-cover-placeholder">
          <text class="placeholder-icon">🎁</text>
        </view>
        <view class="gift-info">
          <view class="row between">
            <text class="gift-name">{{ gift.name }}</text>
            <text class="gift-price">{{ gift.pointsCost }} 积分</text>
          </view>
          <view class="row between" style="margin-top: 16rpx">
            <text class="muted">库存 {{ gift.stock }}</text>
            <view class="small-button" @tap="redeem(gift)">立即兑换</view>
          </view>
        </view>
      </view>
    </view>
    <view v-if="gifts.length === 0" class="card card-empty">
      <text class="muted">暂无礼品</text>
    </view>
    <AiFloatBall />
  </view>
</template>

<style scoped>
.gift-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, rgba(168, 230, 207, 0.35), rgba(168, 216, 234, 0.35));
}

.placeholder-icon {
  font-size: 56rpx;
}
</style>
