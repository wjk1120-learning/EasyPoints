import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 测试独立于 uni 编译链：仅挂 @vitejs/plugin-vue 编译 SFC（uni 条件编译页面在 L3 中不能含 #ifdef）。
// L1/L2 测纯 TS 模块（utils/api）；L3 组件测试用 tests/helpers/uni-stub.ts 注入 uni 全局。
//
// vue 别名指根目录 3.5.35：本机 vitest(Node 24) 下 vue 3.4.21 运行时组件重渲染失效
// （状态翻转后 DOM 不更新，裸 createApp A/B 实测 3.5 正常、3.4 冻结，2026-10-15），
// 生产 uni 编译链仍锁 3.4.21 不受影响；L4 浏览器冒烟在真实工具链上兜底。
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      vue: fileURLToPath(new URL("../../node_modules/vue/dist/vue.runtime.esm-bundler.js", import.meta.url))
    }
  },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"]
  }
});
