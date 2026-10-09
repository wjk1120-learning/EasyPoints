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
/* ── 设计基调：浅灰底 + 白卡 + 品牌蓝 ── */
page {
  background: #f5f6f8;
  color: #1a2233;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
}

.page {
  min-height: 100vh;
  padding: 24rpx 24rpx calc(160rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

/* 自定义导航页在 .page 基础上加，绕开固定定位的 NavBar（114rpx 栏高 + 16rpx 间距） */
.page-nav {
  padding-top: calc(var(--status-bar-height) + 130rpx);
}

.page-tab {
  padding-bottom: calc(160rpx + env(safe-area-inset-bottom));
}

/* ── 卡片 ── */
.card {
  margin-bottom: 20rpx;
  padding: 28rpx;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 1rpx 2rpx rgba(23, 26, 31, 0.03), 0 8rpx 24rpx rgba(23, 26, 31, 0.04);
}

.card-hero {
  background: linear-gradient(135deg, #2e6bf2, #5a8cff);
  color: #fff;
  box-shadow: 0 12rpx 32rpx rgba(47, 107, 255, 0.22);
}

.card-warning {
  background: #fff8e8;
}

.card-info {
  background: #edf3ff;
}

.card-empty {
  padding: 56rpx 32rpx;
  text-align: center;
}

/* ── 文字 ── */
.muted {
  color: #9aa1ab;
  font-size: 24rpx;
}

.section-label {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 8rpx;
}

.pos {
  color: #16a34a !important;
}

.neg {
  color: #f04438 !important;
}

.link {
  color: #2f6bff;
  font-size: 24rpx;
  font-weight: 500;
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
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 16rpx;
  background: #2f6bff;
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
  text-align: center;
}

.button:active {
  opacity: 0.88;
}

.button.ghost {
  background: #f2f3f5;
  color: #344156;
  border: none;
  box-shadow: none;
}

.button.disabled {
  background: #ebedf0;
  color: #b4bac3;
}

.small-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 132rpx;
  height: 60rpx;
  padding: 0 26rpx;
  border-radius: 999rpx;
  background: #edf3ff;
  color: #2f6bff;
  font-size: 24rpx;
  font-weight: 600;
  text-align: center;
  box-shadow: none;
}

.small-button.ghost {
  background: #f2f3f5;
  color: #344156;
}

.small-button.danger {
  background: #feecec;
  color: #f04438;
}

.small-button.disabled {
  background: #f2f3f5;
  color: #b4bac3;
}

.small-button:active,
.button.ghost:active {
  opacity: 0.85;
}

/* ── 状态胶囊 ── */
.pill {
  flex-shrink: 0;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 500;
  background: #f2f3f5;
  color: #86909c;
}

.pill.blue { background: #edf3ff; color: #2f6bff; }
.pill.green { background: #e8f7ee; color: #16a34a; }
.pill.amber { background: #fff6e8; color: #d97706; }
.pill.red { background: #feecec; color: #f04438; }
.pill.purple { background: #f1edff; color: #7c5cbf; }

/* ── 图标块 ── */
.icon-tile {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: #f2f3f5;
}

.icon-tile.blue { background: #eaf3ff; }
.icon-tile.green { background: #e9f7ef; }
.icon-tile.amber { background: #fff6e5; }
.icon-tile.purple { background: #f1edff; }
.icon-tile.red { background: #fdeeee; }

/* ── 表单 ── */
.input,
.textarea,
.picker-field,
.keyword-input {
  width: 100%;
  box-sizing: border-box;
  background: #f7f8fa;
  border: 1rpx solid #ebedf0;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: #1a2233;
}

.input {
  height: 88rpx;
  padding: 0 24rpx;
  margin-top: 12rpx;
}

.textarea {
  min-height: 200rpx;
  margin-top: 16rpx;
  padding: 20rpx 24rpx;
  line-height: 1.6;
}

.input-error,
.textarea-error {
  border-color: #f04438 !important;
  background: #fffafa !important;
}

.error-text {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 12rpx;
  color: #f04438;
  font-size: 24rpx;
}

.picker-field,
.keyword-input {
  display: flex;
  align-items: center;
  height: 80rpx;
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
  color: #b4bac3;
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
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 16rpx;
  background: #2f6bff;
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
  text-align: center;
}

.reset-link {
  color: #2f6bff;
  font-size: 24rpx;
  text-align: right;
  padding-top: 8rpx;
}

/* ── 列表行 ── */
.record-row {
  padding: 22rpx 0;
  border-top: 1rpx solid #f2f3f5;
}

.record-row:first-of-type {
  border-top: none;
  padding-top: 0;
}

.appeal-link {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #2f6bff;
}

.tap-card:active {
  opacity: 0.92;
}

/* ── 分段控件 ── */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 20rpx 24rpx;
}

.segmented {
  display: flex;
  gap: 6rpx;
  padding: 6rpx;
  border-radius: 16rpx;
  background: #eef0f3;
}

.segmented .tab {
  flex: 1;
  min-width: 112rpx;
  height: 60rpx;
  line-height: 60rpx;
  text-align: center;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #6b7280;
  transition: all 0.2s;
}

.segmented .tab.active {
  background: #ffffff;
  color: #1a2233;
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(23, 26, 31, 0.08);
}

/* 兼容旧类名 tabs/tab（大厅、投票、AI 页在用） */
.tabs {
  display: flex;
  gap: 6rpx;
  padding: 6rpx;
  border-radius: 16rpx;
  background: #eef0f3;
}

.tab {
  min-width: 112rpx;
  height: 60rpx;
  line-height: 60rpx;
  text-align: center;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #6b7280;
  transition: all 0.2s;
}

.tab.active {
  background: #ffffff;
  color: #1a2233;
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(23, 26, 31, 0.08);
}

.action-link {
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 20rpx;
  border-radius: 14rpx;
  background: #edf3ff;
  color: #2f6bff;
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

.badge.pending { background: #fff6e8; color: #d97706; }
.badge.processing { background: #edf3ff; color: #2f6bff; }
.badge.sent { background: #e8f7ee; color: #16a34a; }
.badge.failed { background: #feecec; color: #f04438; }

.corner-badge {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  min-width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: #f04438;
  color: #fff;
  font-size: 20rpx;
  font-weight: 600;
  text-align: center;
}

.unread-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 999rpx;
  background: #f04438;
  flex-shrink: 0;
}

/* ── 弹层 ── */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

/* ── 商城（旧类名兼容） ── */
.gift-cover {
  width: 152rpx;
  height: 152rpx;
  border-radius: 16rpx;
  overflow: hidden;
  margin-right: 24rpx;
  flex-shrink: 0;
  background: #f2f3f5;
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
  color: #1a2233;
}

.gift-price {
  font-size: 28rpx;
  font-weight: 700;
  color: #2f6bff;
  flex-shrink: 0;
}

/* ── 订单状态 ── */
.status-pill {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 500;
  background: #edf3ff;
  color: #2f6bff;
}
</style>
