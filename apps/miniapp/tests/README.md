# miniapp 测试分层

对齐 admin-web 四层体系，随逐步切换逐层补齐：

| 层 | 目录 | 内容 | 现状 |
|---|---|---|---|
| L1 单元 | `unit/` | 纯函数（utils/format、请求层解析） | ✅ format 已有 |
| L2 契约 | `contract/` | fixture=后端文档示例，uni-stub 注入验证请求/解析 | ✅ request 内核已有（helpers/uni-stub.ts） |
| L3 组件 | `components/` | @vue/test-utils + uni 全局 stub，测表单校验/payload | 第 3 阶段起 |
| L4 冒烟 | `e2e/` | H5 dev server + Playwright 全页走查 | 第 3 阶段起 |

运行：`npm test`（或 `npx vitest run`）；类型检查：`npm run typecheck`。
