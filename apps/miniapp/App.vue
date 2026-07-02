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
  background: #f5f7fb;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif;
}

.page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
}

.card {
  margin-bottom: 24rpx;
  padding: 28rpx;
  background: #fff;
  border-radius: 12rpx;
  box-shadow: 0 8rpx 22rpx rgba(31, 41, 55, 0.06);
}

.muted {
  color: #6b7280;
  font-size: 24rpx;
}

.button {
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 8rpx;
  background: #1677ff;
  color: #fff;
  text-align: center;
}
</style>
