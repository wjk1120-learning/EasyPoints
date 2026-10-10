# 小程序端接口需求契约（提交给 `apps/api` 负责人）

> 提出方：员工端小程序（`apps/miniapp`）。
> 本文档是前端当前全部「等后端」需求的正式契约：待实现接口、已有接口补字段、AI 升级引用、通用行为约定。
> 每一项的出参结构 = 前端页面实际读取的字段，与 `apps/miniapp/mock/index.js` 的模拟数据一一对齐（mock 文件即本契约的示例）；后端按此实现后，前端删除 mock 即可切换真实数据（见 §7）。
> 日期：2026-10-10。字段或行为有变更时，由双方协商后同步更新本文档与 `docs/api.md`。

## 0. 总览与优先级建议

| 序号 | 需求 | 涉及接口 | 建议 | 前端现状 |
|---|---|---|---|---|
| R1 | 规则中心 | `GET /miniapp/rules` | P0（AI 升级也依赖规则数据源） | mock 兜底 |
| R2 | 任务大厅 | `GET /miniapp/tasks`、`claim`、`submit` | P0 | mock 兜底（仅 GET） |
| R3 | 我的投票 | `GET /miniapp/votes`、`/{id}`、`ballots` | P0 | mock 兜底（仅 GET） |
| R4 | 积分申请 | `GET/POST /miniapp/point-applications` | P1 | mock 兜底（仅 GET） |
| R5 | 申诉记录列表 | `GET /miniapp/appeals` | P1 | mock 兜底 |
| R6 | 双积分字段 | `home`、`leaderboard` 补字段 | P1 | 字段级补丁演示值 |
| R7 | AI 小易升级 | `POST /miniapp/ai/ask` 多轮 + 工具化 | P1（契约已单独成文） | 前端已就绪 |
| R8 | 通知深链 payload | `GET /miniapp/messages` 条目补 `voteId` | P2 | 前端已按「有 voteId 就跳详情」写好 |

不再需要：`GET /miniapp/hall`、`GET /miniapp/hall/unread-count`——积分大厅页已于 2026-10-10 删除，前端不再消费（接口保留与否由后端决定）。

## 1. 通用约定（全部接口）

- 鉴权：员工 JWT（`Authorization: Bearer <token>`，`typ=employee`），与现有 `/miniapp/*` 一致；所有数据只允许返回**当前登录员工本人**范围。
- 响应包装：`{ "data": ... }`；列表需要分页时 `{ "data": [...], "meta": { "page", "pageSize", "total" } }`（与现有分页约定一致；数据量小的列表可以不分页，直接返回全量数组）。
- 错误：非 2xx 返回 `{ "message": "中文可展示原因" }`，前端原样 toast。
- 时间：ISO 8601 字符串（与现有 `occurredAt` 风格一致）。
- 枚举状态建议同时返回机器值 `status` 与展示值 `statusText`（前端有默认映射，后端给了就用后端的）。

## 2. R1 规则中心

### `GET /miniapp/rules`

出参：

```json
{ "data": [{ "title": "申诉规则", "content": "申诉须针对本人积分流水发起，需说明具体理由；\n申诉预计 3 个工作日内完成处理；……" }] }
```

- `title`：规则分组名（积分章程 / 任务规则 / 商城规则 / 申诉规则……）。
- `content`：该组条目全文，条目间用换行或分号分隔；前端按纯文本渲染。
- 条数预期 ≤ 20 组，不需要分页。
- **建议同一份数据作为 AI 的规则知识源**（见 `ai/BACKEND-SPEC.md` §3.6），一处维护两处消费。

## 3. R2 任务大厅

### `GET /miniapp/tasks?scope=all|mine`

出参：

```json
{ "data": [{
  "id": "task-001",
  "title": "10月客户回访：重点客户满意度调研",
  "description": "完成 3 家重点客户回访并提交调研纪要……",
  "status": "open",
  "statusText": "可领取",
  "rewardPoints": 50,
  "deadline": "2026-10-17T00:00:00.000Z"
}] }
```

- `status` 枚举：`open`（可领取）、`in_progress`（进行中）、`pending_review`（待审核）、`approved`（已通过）、`rejected`（已驳回）；`statusText` 可选。
- `scope=all` 全部任务，`scope=mine` 我领取/提交过的；缺省 `all`。
- 排序建议：截止时间临近的在前。

### `POST /miniapp/tasks/{id}/claim`

- 行为：当前员工领取任务，`open → in_progress`。
- 成功：`201`，`data` 为更新后的任务对象（结构同上）。
- 冲突：已被领完/已领取 → `409` + message（前端如实提示，不重试）。

### `POST /miniapp/tasks/{id}/submit`

- 入参：`{ "content": "成果说明文本" }`（必填非空）。
- 行为：提交成果，`in_progress → pending_review`；审核通过后由管理端录分（备注注明任务名称），**本接口不动积分**。
- 成功：`201`，`data` 为更新后的任务对象。
- 未领取就提交 / 重复提交 → `400` / `409` + message。

## 4. R3 我的投票

### `GET /miniapp/votes?scope=pending|history`

出参（列表项）：

```json
{ "data": [{
  "id": "vote-001",
  "title": "Q4 团建方案评选",
  "description": "从三个候选方案中选出本次季度团建的去向。",
  "mode": "single",
  "submitted": false,
  "closed": false,
  "expired": false,
  "deadline": "2026-10-13T00:00:00.000Z",
  "relatedLabel": "10月团队活动"
}] }
```

- `scope=pending` 未提交且未截止；`scope=history` 已提交或已截止；缺省 `pending`。
- `mode`：`single` 单选 / `multiple` 多选。

### `GET /miniapp/votes/{id}`

详情在列表字段基础上增加：

```json
{ "data": { "id": "vote-001", "title": "...", "mode": "single", "submitted": true,
  "options": [{ "id": "v1o1", "text": "周边城市两日游" }],
  "selectedOptionIds": ["v1o1"] } }
```

- `selectedOptionIds` 仅 `submitted: true` 时返回（回显本人已投项）。

### `POST /miniapp/votes/{id}/ballots`

- 入参：`{ "optionIds": ["v1o1"] }`；`single` 模式必须恰好 1 项，`multiple` 至少 1 项。
- 行为：记录本人投票，`submitted → true`。**每人限一次，不自动加积分**（票数是否关联积分由管理端另走录分流程）。
- 成功：`201`，`data` 为更新后的投票详情（含 `selectedOptionIds`）。
- 重复投票 / 已截止 / 选项不属于该投票 → `409` / `400` + message。

## 5. R4 积分申请

### `GET /miniapp/point-applications`

出参：

```json
{ "data": [{
  "id": "app-002",
  "points": 10,
  "description": "周末值守系统上线保障。",
  "status": "pending",
  "statusText": "待审核",
  "createdAt": "2026-10-08T00:00:00.000Z",
  "updatedAt": "2026-10-09T00:00:00.000Z"
}] }
```

- `status`：`pending` / `approved` / `rejected`；按 `createdAt` 倒序。

### `POST /miniapp/point-applications`

- 入参：`{ "points": 10, "description": "周末值守系统上线保障。" }`；`points` 为正整数，`description` 必填非空。
- 行为：创建本人申请，进入管理端审核；**审核通过后由管理端录分**，本接口不动积分。
- 成功：`201`，`data` 为创建的申请对象。

## 6. R5 申诉记录列表 + R6 双积分 + R8 深链

### `GET /miniapp/appeals`（R5）

出参：

```json
{ "data": [{
  "id": "apl-001",
  "pointRecordId": 2,
  "reason": "10月考勤扣分有异议……",
  "status": "pending",
  "statusText": "处理中",
  "resolution": "（仅驳回/已处理时返回：处理意见）",
  "createdAt": "2026-10-09T00:00:00.000Z"
}] }
```

- 只返回本人申诉；创建仍走已有 `POST /miniapp/appeals`（带本人 `pointRecordId`），不需要新写接口。

### R6 双积分补字段

- `GET /miniapp/home`：响应增加 `actualPoints`（实际积分）、`honorPoints`（荣誉积分，如无此概念可省略）；现有 `pointsBalance` 语义保持「实时积分（可兑换）」。
- `GET /miniapp/leaderboard`：每项增加 `actualPoints`、`availablePoints`；缺省时前端两榜暂用同一份 `pointsBalance` 并对实际积分显示「—」。
- 字段就绪后，前端删除 `mock/index.js` 里 `MOCK_FIELD_PATCH` 的 `actualPoints` 演示值。

### R8 通知深链（P2）

- `GET /miniapp/messages` 的条目增加可选 `voteId`（或 `payload: { voteId }`）：`type` 为 `vote_assigned` / `vote` 的通知带上后，前端点击直达投票详情；没有则进「我的投票」列表。

## 7. R7 AI 小易升级（引用）

完整契约见 [`apps/miniapp/ai/BACKEND-SPEC.md`](ai/BACKEND-SPEC.md)，要点：

- `POST /miniapp/ai/ask` 入参增加可选 `history`（≤10 轮，后端须截断校验），实现多轮会话；
- DeepSeek Function Calling 工具集 v1（6 个只读工具：余额 / 流水 / 月度汇总 / 礼品 / 订单 / 规则），全部以当前员工身份执行、复用现有 services；
- 平台规则知识全文注入 system prompt（数据源建议与 R1 `GET /miniapp/rules` 同源）；
- 保留规则引擎兜底；配套扩展 `apps/api/tests/employee-ai.test.js` 评测集。
- 补充一条小需求：system prompt 增加约束「回答不要使用 Markdown 格式（星号、井号等）」——当前回答中的 `**加粗**` 在聊天气泡里按纯文本原样显示（前端也可改为渲染转换，二选一，后端加约束成本最低）。

## 8. 前端配套承诺（后端交付后我方动作）

1. 每个接口就绪：前端验证真实返回后，删除 `mock/index.js` 对应条目；
2. 全部就绪：`MOCK_SWITCH.enabled = false` 验证无影响 → 删除 mock 文件 → 删除 `api.js` 中 `mockFallback` / `patchFields` 两处引用；
3. R6 字段就绪：删除 `MOCK_FIELD_PATCH` 演示值；
4. 本文档条目交付后标记 ✅ 并同步 `docs/api.md`（由后端负责）与 `docs/rule.md` §4 的契约表（由前端负责）。

## 9. 已有接口清单（无需改动，列出让后端对照全貌）

`POST /miniapp/auth/login`、`GET /miniapp/home`、`GET /miniapp/messages`、`POST /miniapp/messages/{id}/read`、`POST /miniapp/messages/read-all`、`GET /miniapp/points/records`、`POST /miniapp/appeals`、`GET /miniapp/mall/gifts`、`POST /miniapp/orders`、`GET /miniapp/orders`、`GET /miniapp/leaderboard`、`POST /miniapp/ai/ask`（升级见 §7）。
