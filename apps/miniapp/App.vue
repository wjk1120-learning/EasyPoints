<script>
import { loginEmployee } from "./api";

export default {
  onLaunch() {
    const existing = uni.getStorageSync("employeeToken");
    if (existing) return;
    loginEmployee().catch(() => {});
  }
};
</script>

<style>
page {
  background: linear-gradient(165deg, #e8f4fc 0%, #edf9f4 38%, #f0f7ff 72%, #e6f2fa 100%);
  background-attachment: fixed;
  color: #1c1c1e;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
}

.page {
  min-height: 100vh;
  padding: 24rpx 28rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.page-tab {
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

/* ── 液态玻璃卡片 ── */
.card {
  margin-bottom: 20rpx;
  padding: 32rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.62);
  border: 1rpx solid rgba(255, 255, 255, 0.88);
  box-shadow:
    0 8rpx 32rpx rgba(91, 155, 213, 0.07),
    0 1rpx 0 rgba(255, 255, 255, 0.95) inset;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.card-hero {
  background: linear-gradient(145deg, rgba(168, 230, 207, 0.42), rgba(168, 216, 234, 0.48));
  border: 1rpx solid rgba(255, 255, 255, 0.75);
  box-shadow:
    0 12rpx 40rpx rgba(107, 203, 154, 0.12),
    0 1rpx 0 rgba(255, 255, 255, 0.8) inset;
}

.card-warning {
  background: rgba(255, 251, 235, 0.72);
  border: 1rpx solid rgba(251, 191, 36, 0.28);
}

.card-empty {
  padding: 48rpx 32rpx;
  text-align: center;
}

/* ── 文字 ── */
.muted {
  color: #8e8e93;
  font-size: 24rpx;
}

.section-label {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
  text-transform: uppercase;
  color: #8e8e93;
  margin-bottom: 8rpx;
}

.pos {
  color: #34c759 !important;
}

.neg {
  color: #ff3b30 !important;
}

/* ── 布局 ── */
.row {
  display: flex;
  align-items: center;
}

.between {
  justify-content: space-between;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

/* ── 按钮 ── */
.button {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #6bcb9a 0%, #5b9bd5 100%);
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.5rpx;
  box-shadow: 0 8rpx 28rpx rgba(91, 155, 213, 0.28);
}

.button:active {
  opacity: 0.88;
  transform: scale(0.985);
}

.button.ghost {
  background: rgba(255, 255, 255, 0.55);
  color: #3a7ca5;
  border: 1rpx solid rgba(91, 155, 213, 0.22);
  box-shadow: none;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.small-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 140rpx;
  height: 64rpx;
  padding: 0 24rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #6bcb9a, #5b9bd5);
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(91, 155, 213, 0.22);
}

.small-button.ghost {
  background: rgba(255, 255, 255, 0.5);
  color: #3a7ca5;
  border: 1rpx solid rgba(91, 155, 213, 0.2);
  box-shadow: none;
}

.small-button:active,
.button.ghost:active {
  opacity: 0.85;
}

/* ── 表单 ── */
.input,
.textarea,
.picker-field,
.keyword-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.72);
  border: 1rpx solid rgba(91, 155, 213, 0.14);
  border-radius: 18rpx;
  font-size: 28rpx;
  color: #1c1c1e;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.input {
  height: 80rpx;
  padding: 0 24rpx;
  margin-top: 12rpx;
}

.textarea {
  min-height: 200rpx;
  margin-top: 16rpx;
  padding: 20rpx 24rpx;
  line-height: 1.6;
}

.picker-field,
.keyword-input {
  display: flex;
  align-items: center;
  height: 76rpx;
  padding: 0 24rpx;
}

.keyword-input {
  flex: 1;
  min-width: 0;
}

.picker-field {
  justify-content: space-between;
}

.picker-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  margin-left: 12rpx;
  color: #aeaeb2;
  font-size: 18rpx;
  flex-shrink: 0;
}

.filter-row,
.search-row {
  display: flex;
  align-items: stretch;
  gap: 16rpx;
  width: 100%;
  box-sizing: border-box;
}

.picker-wrap {
  flex: 1;
  min-width: 0;
}

.picker-wrap picker {
  display: block;
  width: 100%;
}

.search-button {
  width: 128rpx;
  flex-shrink: 0;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #6bcb9a, #5b9bd5);
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
  text-align: center;
  box-shadow: 0 4rpx 16rpx rgba(91, 155, 213, 0.22);
}

.reset-link {
  color: #5b9bd5;
  font-size: 24rpx;
  text-align: right;
  padding-top: 8rpx;
}

/* ── 列表行 ── */
.record-row {
  padding: 22rpx 0;
  border-top: 1rpx solid rgba(91, 155, 213, 0.08);
}

.record-row:first-of-type {
  border-top: none;
  padding-top: 0;
}

.appeal-link {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #5b9bd5;
}

.tap-card:active {
  opacity: 0.92;
  transform: scale(0.992);
}

/* ── 分段控件 (iOS Segmented) ── */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 24rpx 28rpx;
}

.tabs {
  display: flex;
  gap: 6rpx;
  padding: 6rpx;
  border-radius: 16rpx;
  background: rgba(142, 142, 147, 0.12);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.tab {
  min-width: 112rpx;
  height: 56rpx;
  line-height: 56rpx;
  text-align: center;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #8e8e93;
  transition: all 0.2s;
}

.tab.active {
  background: rgba(255, 255, 255, 0.92);
  color: #1c1c1e;
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.action-link {
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 20rpx;
  border-radius: 14rpx;
  background: rgba(91, 155, 213, 0.12);
  color: #3a7ca5;
  font-size: 24rpx;
  font-weight: 500;
}

.action-link.disabled {
  opacity: 0.4;
}

/* ── 徽章 ── */
.badge {
  flex-shrink: 0;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 500;
}

.badge.pending { background: rgba(91, 155, 213, 0.14); color: #3a7ca5; }
.badge.processing { background: rgba(175, 130, 255, 0.14); color: #7c5cbf; }
.badge.sent { background: rgba(52, 199, 89, 0.14); color: #248a3d; }
.badge.failed { background: rgba(255, 59, 48, 0.12); color: #d70015; }

.corner-badge {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  min-width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: #ff3b30;
  color: #fff;
  font-size: 20rpx;
  font-weight: 600;
  text-align: center;
}

.unread-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: #5b9bd5;
  flex-shrink: 0;
}

/* ── 商城 ── */
.gift-cover {
  width: 152rpx;
  height: 152rpx;
  border-radius: 20rpx;
  overflow: hidden;
  margin-right: 24rpx;
  flex-shrink: 0;
  background: rgba(142, 142, 147, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.6);
}

.gift-cover-image {
  width: 100%;
  height: 100%;
  display: block;
}

.gift-info {
  flex: 1;
  min-width: 0;
}

.gift-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1c1c1e;
}

.gift-price {
  font-size: 28rpx;
  font-weight: 700;
  color: #34c759;
  flex-shrink: 0;
}

/* ── 订单状态 ── */
.status-pill {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 500;
  background: rgba(91, 155, 213, 0.12);
  color: #3a7ca5;
}
</style>
