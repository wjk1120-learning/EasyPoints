<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getApiBase, request } from '../../api'
import NavBar from '../../components/NavBar.vue'
import AppTabBar from '../../components/AppTabBar.vue'
import AiFloatBall from '../../components/AiFloatBall.vue'
import AppIcon from '../../components/AppIcon.vue'
import EmptyState from '../../components/EmptyState.vue'

const gifts = ref([])
const balance = ref(0)
const dialog = ref(null)
const filter = ref('all')
const apiBase = getApiBase()

const visibleGifts = computed(() => gifts.value.filter((gift) => gift.status !== 'inactive' && gift.status !== 'unpublished'))

// 可兑换 = 有库存 且 当前积分够
const displayGifts = computed(() => {
  if (filter.value !== 'redeemable') return visibleGifts.value
  return visibleGifts.value.filter((gift) => Number(gift.stock) > 0 && balance.value >= Number(gift.pointsCost || 0))
})

onShow(load)

async function load() {
  try {
    const [giftRows, home] = await Promise.all([
      request('/miniapp/mall/gifts'),
      request('/miniapp/home')
    ])
    gifts.value = Array.isArray(giftRows) ? giftRows : []
    balance.value = Number(home?.pointsBalance || 0)
  } catch (error) {
    uni.showToast({ title: error?.message || '加载失败', icon: 'none' })
  }
}

function openRedeem(gift) {
  if (Number(gift.stock) <= 0) return
  const enough = balance.value >= Number(gift.pointsCost || 0)
  dialog.value = { gift, enough, after: balance.value - Number(gift.pointsCost || 0) }
}

async function confirmRedeem() {
  const gift = dialog.value?.gift
  if (!gift || !dialog.value.enough) return
  try {
    await request('/miniapp/orders', { method: 'POST', data: { giftId: gift.id } })
    dialog.value = null
    uni.showToast({ title: '兑换申请已提交' })
    await load()
  } catch (error) {
    uni.showToast({ title: error?.message || '兑换失败', icon: 'none' })
  }
}

function isSoldOut(gift) {
  return Number(gift.stock) <= 0
}

function isElectronic(gift) {
  return gift.deliveryType === 'electronic' || gift.type === 'electronic' || gift.electronic === true
}

function formatPoints(value) {
  const num = Number(value || 0)
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
</script>

<template>
  <view class="page page-tab page-nav">
    <NavBar title="积分商城" :back="false" />

    <view class="card mall-head">
      <view class="mall-balance">
        <text class="mall-balance-label">可用积分</text>
        <text class="mall-balance-num">{{ formatPoints(balance) }}</text>
      </view>
      <text class="mall-orders-link" @tap="uni.navigateTo({ url: '/pages/orders/index' })">兑换记录 ›</text>
    </view>

    <view class="chips">
      <text class="chip" :class="{ 'chip-on': filter === 'all' }" @tap="filter = 'all'">全部礼品</text>
      <text class="chip" :class="{ 'chip-on': filter === 'redeemable' }" @tap="filter = 'redeemable'">可兑换礼品</text>
    </view>

    <view class="gift-grid">
      <view v-for="gift in displayGifts" :key="gift.id" class="gift press" :class="{ sold: isSoldOut(gift) }" @tap="openRedeem(gift)">
        <view class="cover">
          <image v-if="gift.coverImageUrl" class="cover-img" :src="apiBase + gift.coverImageUrl" mode="aspectFill" />
          <view v-else class="cover-placeholder"><AppIcon name="gift" :size="64" color="faint" /></view>
          <text class="cover-tag" :class="isSoldOut(gift) ? 'cover-tag-sold' : 'cover-tag-on'">
            {{ isSoldOut(gift) ? '已售罄' : '上架中' }}
          </text>
          <view v-if="isSoldOut(gift)" class="cover-dim" />
        </view>
        <view class="gift-body">
          <text class="gift-name">{{ gift.name }}</text>
          <view class="gift-price-row">
            <view class="gift-price">
              <AppIcon name="coin" :size="28" color="amber" />
              <text class="gift-points">{{ formatPoints(gift.pointsCost) }}</text>
              <text class="gift-unit">积分</text>
            </view>
            <text class="gift-stock">{{ isSoldOut(gift) ? '库存 0' : `剩余 ${gift.stock}` }}</text>
          </view>
        </view>
      </view>
      <view v-if="displayGifts.length === 0" class="card card-empty gift-empty">
        <EmptyState icon="shopping-bag" title="商城暂无礼品" />
      </view>
    </view>

    <view v-if="dialog" class="mask" @tap="dialog = null">
      <view class="dialog" @tap.stop>
        <view class="dialog-close" @tap="dialog = null"><AppIcon name="x" :size="32" color="muted" /></view>
        <text class="dialog-title">{{ dialog.enough ? '确认兑换' : '积分不足' }}</text>
        <view class="dialog-gift">
          <view class="dialog-cover">
            <image v-if="dialog.gift.coverImageUrl" class="cover-img" :src="apiBase + dialog.gift.coverImageUrl" mode="aspectFill" />
            <view v-else class="cover-placeholder"><AppIcon name="gift" :size="64" color="faint" /></view>
          </view>
          <view class="dialog-gift-info">
            <text class="dialog-gift-name">{{ dialog.gift.name }}</text>
            <text v-if="isElectronic(dialog.gift)" class="pill blue dialog-tag">电子兑换码</text>
          </view>
        </view>
        <view class="dialog-row">
          <text class="dialog-label">消耗积分</text>
          <text class="dialog-cost">{{ formatPoints(dialog.gift.pointsCost) }} 积分</text>
        </view>
        <view class="dialog-row">
          <text class="dialog-label">兑换后余额</text>
          <text class="dialog-after" :class="{ neg: !dialog.enough }">
            {{ dialog.enough ? `${formatPoints(dialog.after)} 积分` : `-${formatPoints(Math.abs(dialog.after))} 积分` }}
          </text>
        </view>
        <view v-if="dialog.enough" class="dialog-note">确认后进入审核，审核通过后发送至企业微信消息。</view>
        <view v-else class="dialog-warn">
          <AppIcon name="alert-triangle" :size="36" color="amber" />
          <text>当前可用积分 {{ formatPoints(balance) }}，暂无法兑换该礼品</text>
        </view>
        <view class="dialog-buttons">
          <view class="dialog-cancel" @tap="dialog = null">取消</view>
          <view
            class="dialog-ok"
            :class="{ 'dialog-ok-disabled': !dialog.enough }"
            @tap="confirmRedeem"
          >
            {{ dialog.enough ? '确认兑换' : '积分不足' }}
          </view>
        </view>
      </view>
    </view>

    <AiFloatBall />
    <AppTabBar />
  </view>
</template>

<style scoped>
.mall-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
}

.mall-balance-label {
  display: block;
  font-size: 24rpx;
  color: var(--ink-3);
}

.mall-balance-num {
  display: block;
  margin-top: 4rpx;
  font-size: 44rpx;
  font-weight: 800;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.mall-orders-link {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--brand);
}

.mall-orders-link:active {
  opacity: 0.6;
}

.chips {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.chip {
  padding: 10rpx 28rpx;
  border-radius: 999rpx;
  background: var(--surface);
  color: var(--ink-3);
  font-size: 26rpx;
}

.chip-on {
  background: var(--brand);
  color: var(--surface);
  font-weight: 600;
}

/* 不用 flex gap / calc：小程序渲染器对两者支持不完整，用百分比宽 + space-between 保证两端一致 */
.gift-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.gift {
  width: 48.6%;
  margin-bottom: 20rpx;
  border-radius: 20rpx;
  background: var(--surface);
  overflow: hidden;
  box-shadow: 0 1rpx 2rpx rgba(23, 26, 31, 0.03), 0 8rpx 24rpx rgba(23, 26, 31, 0.04);
}

.gift:active {
  opacity: 0.9;
}

.gift.sold .gift-name,
.gift.sold .gift-points {
  color: var(--muted);
}

.cover {
  position: relative;
  width: 100%;
  height: 280rpx;
  background: #eef3fe;
}

.cover-img {
  width: 100%;
  height: 100%;
  display: block;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 72rpx;
}

.cover-tag {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  z-index: 2;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 600;
}

.cover-tag-on {
  background: rgba(255, 255, 255, 0.92);
  color: var(--brand);
}

.cover-tag-sold {
  background: rgba(26, 34, 51, 0.55);
  color: var(--surface);
}

.cover-dim {
  position: absolute;
  inset: 0;
  background: rgba(245, 246, 248, 0.45);
}

.gift-body {
  padding: 20rpx 24rpx 24rpx;
}

.gift-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gift-price-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 12rpx;
}

.gift-price {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
}

.gift-points {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--brand);
  font-variant-numeric: tabular-nums;
}

.gift-unit {
  font-size: 22rpx;
  color: var(--muted);
}

.gift-stock {
  font-size: 22rpx;
  color: var(--muted);
}

.gift-empty {
  width: 100%;
}

.dialog {
  position: relative;
  width: 620rpx;
  padding: 40rpx 32rpx 32rpx;
  border-radius: 28rpx;
  background: var(--surface);
}

.dialog-close {
  position: absolute;
  top: 24rpx;
  right: 28rpx;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--faint);
  font-size: 28rpx;
}

.dialog-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--ink);
}

.dialog-gift {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 28rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: var(--field);
}

.dialog-cover {
  width: 104rpx;
  height: 104rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: #eef3fe;
  flex-shrink: 0;
}

.dialog-gift-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10rpx;
}

.dialog-gift-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink);
}

.dialog-tag {
  font-size: 20rpx;
}

.dialog-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
}

.dialog-label {
  font-size: 26rpx;
  color: var(--ink-3);
}

.dialog-cost {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--red);
  font-variant-numeric: tabular-nums;
}

.dialog-after {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.dialog-note {
  margin-top: 24rpx;
  font-size: 22rpx;
  color: var(--muted);
  line-height: 1.6;
}

.dialog-warn {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 24rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  background: var(--red-soft);
  color: var(--red);
  font-size: 24rpx;
}

.dialog-buttons {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
}

.dialog-cancel {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 16rpx;
  background: var(--fill);
  color: #344156;
  font-size: 30rpx;
  font-weight: 600;
  text-align: center;
}

.dialog-cancel:active {
  opacity: 0.85;
}

.dialog-ok {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 16rpx;
  background: var(--brand);
  color: var(--surface);
  font-size: 30rpx;
  font-weight: 600;
  text-align: center;
}

.dialog-ok:active {
  opacity: 0.88;
}

.dialog-ok-disabled {
  background: var(--line);
  color: var(--faint);
}
</style>
