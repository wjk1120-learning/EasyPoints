import { defineConfig } from "vitest/config";

// 测试独立于 uni 编译链：不加载 uni vite 插件。
// L1/L2 测纯 TS 模块（utils/api）；L3 组件测试在逐步切换阶段补充（届时补 uni 全局 stub helper）。
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"]
  }
});
