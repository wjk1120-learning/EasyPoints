# AI 小易 · 智能体模块（员工端侧）

AI 小易相关的员工端文件全部收在这个目录，方便查看、修改、管理。

## 文件清单

| 文件 | 作用 | 你可以放心改的地方 |
|---|---|---|
| `agent.js` | 会话状态机：维护消息与开场白，携带最近 10 轮历史调用 `POST /miniapp/ai/ask`（请求经 `api.js` 的 `askAi`，本目录不做第二套请求封装） | 开场白文案 `GREETING`、历史条数 `HISTORY_LIMIT`（上限 10，与后端契约一致） |
| `BACKEND-SPEC.md` | 给后端的完整改造契约（方案 B：规则注入 + Function Calling 只读工具 + 多轮 + 规则引擎兜底）。后端照此实施 `apps/api/src/services/employee-ai.js` | 文案、评测集补充；工具清单/接口字段改动需与后端确认后同步 |
| `README.md` | 本说明 | — |

页面仍是 `pages/ai/index.vue`（`pages.json` 不变），只负责渲染与交互，会话逻辑全部从本目录的 `agent.js` 引入。

## 边界：大脑在后端，这里是「脸面 + 说明书」

Function Calling 工具循环、规则知识注入、DeepSeek Key 全部在 `apps/api/src/services/employee-ai.js`（后端负责人按 `BACKEND-SPEC.md` 实施）。小程序是装在员工手机上的客户端，**不能也不应**在这里做工具调用或保存模型 Key（Key 会被反编译提取，权限校验也必须在服务端）。

后端升级前后端行为兼容：`agent.js` 发出的 `history` 字段旧后端会忽略，升级后自动获得多轮追问能力，本目录无需改动。

## 当前进度与后端依赖

- [x] 前端：多轮历史携带（`agent.js`）、页面接入
- [ ] 后端：按 `BACKEND-SPEC.md` 实施工具集 v1（6 个只读工具）+ 规则注入 + 多轮
- [ ] 后端：评测集扩展（`apps/api/tests/employee-ai.test.js`）
- [ ] 二期：`actions` 深链渲染、SSE 流式、动态快捷问题、有用/没用反馈按钮（前端部分届时也加在本目录）
