# admin-web 前端接口需求清单

> 用途：admin-web 改造期间，前端（mock 先行）与后端团队的接口对齐依据。后端每落地一项，前端摘除对应 mock 切换真实接口。
> 约定：本文档按业务域组织，与前端 `apps/admin-web/src/api/<域>/types.ts` 一一对应——**types.ts 即各接口的类型契约，字段命名以类型文件为准**。

## 一、通用约定

- 鉴权：`Authorization: Bearer <JWT>`（`POST /admin/auth/login` 签发，12h）；开发环境无 token 时前端发 `x-admin-id` 冒充头（生产禁用）。
- 响应：裸 JSON。单对象/数组返回 `{ data: ... }`；分页返回 `{ data: [...], meta: { total, page, pageSize } }`。
- 错误：非 2xx 返回 `{ message: "可读错误文案" }`，前端直接 toast 该文案。
- 所有写操作要求：防重复提交由前端负责，后端做幂等兜底；写操作一律记操作日志（操作人/时间/对象/内容）。

## 二、现状已对接（无需后端改动）

登录/角标（auth）、员工列表（employee）、积分录入（points）、积分报表+Excel 导出（report）、礼品管理（mall）、订单（order）、申诉（appeal）、操作日志（log）、消息 Outbox 运维（outbox）——均已在 `src/api/` 各域对接现有后端。

## 三、待开发接口需求

### 3.1 通讯录同步（wecom 域）｜优先级：P0 数据源头

**现状**：`POST /admin/wecom/sync-contacts` 为 mock——需要调用方把 `contacts` 数组放进请求体才落库，并未真正对接企业微信。

**需求**：后端主动从企业微信拉取通讯录并落库，前端只负责触发与展示。

| 项 | 要求 |
|---|---|
| 触发 | `POST /admin/wecom/sync-contacts`（无请求体），前端一键导入按钮调用 |
| 拉取 | 后端调企微 API：获取部门列表 → 逐部门获取成员详情（需企微后台配置 secret / 可信 IP / 可见范围） |
| 落库 | 按 `wecomUserId` 增量 upsert：新员工入库（积分 0）；在职员工更新姓名/部门；**离职/不可见员工自动禁用**（禁用后不可登录小程序/不可兑换/不可被勾选为投票参与人，历史流水保留） |
| 日志 | 写 `wecom.contacts_synced` 操作日志 |
| 响应 | **目标结构**：`{ data: { created: 新增人数, updated: 更新人数, disabled: 禁用人数, total: 本次同步总人数 } }` |
| 前端兼容 | 当前 mock 返回员工数组 `Employee[]`，前端已兼容；后端改为统计结构后前端同步切换（页面「上次同步人数」改用 total） |
| 频控 | 同步为重操作，建议后端加进行中锁（重复触发返回 409 + message） |

**关联前端文件**：`src/api/wecom/wecom.ts`、员工积分页工具栏「同步企微通讯录」按钮（`src/views/EmployeePoints.vue`）

### 3.2 员工双积分字段（employee 域）｜优先级：P0

- 员工对象需增加双积分字段（PRD 3.1）：`realtimePoints`（实时积分=可用余额）、`actualPoints`（实际积分=终身累计荣誉分）。
- 现有 `pointsBalance` 保留过渡，双积分落地后前端切换为双列展示。
- `POST /admin/points/adjustment` 语义同步升级：加分双积分同加、扣分双积分同扣（备注必填不变）。
- 详细计算规则见 PRD 3.1，前端各页面（员工积分/工作台/报表）在阶段 2 按此改造。

### 3.3 后续章节（随阶段推进补充）

- 3.3 积分申请（application 域）——阶段 2
- 3.4 任务管理+任务审核（task 域）——阶段 3
- 3.5 审核中心聚合计数（badges 扩展四类待办）——阶段 3
- 3.6 投票管理全套（vote 域）——阶段 4
- 3.7 规则配置读写（rule 域）——阶段 5
- 3.8 全套 Excel 导出 + 日志分类筛选扩展——阶段 6
