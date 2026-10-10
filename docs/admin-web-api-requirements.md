# admin-web 管理端接口需求文档（SpringBoot 重构契约版）

> **背景**：后端将由 SpringBoot 全量重构，现有 Node 后端（apps/api）仅作参考。本文档覆盖管理端（apps/admin-web）用到的**全部接口**——无论旧后端是否已实现——是新后端唯一实现依据。
> **字段命名以前端 `apps/admin-web/src/api/<域>/types.ts` 为准**（types.ts 即类型契约）；本文档按业务域组织，与前端域目录一一对应。
> 员工端（小程序）接口不在本文档范围，由小程序端单独提需求。

## 一、通用约定

### 1.1 鉴权
- 除登录外所有接口要求 `Authorization: Bearer <JWT>`；token 由 `POST /admin/auth/login` 签发，有效期 12h。
- token 过期/无效返回 401，前端收到 401 会清除登录态回登录页。
- 管理员角色：`super_admin`（超管）/ `hr_admin`（人事）/ `department_admin`（部门管理员，仅本部门员工可见可操作）。

### 1.2 响应与错误
- 裸 JSON，统一 `{ data: ... }` 包装；分页接口返回 `{ data: [...], meta: { total, page, pageSize } }`。
- GET 列表接口不传 `page/pageSize` 时返回全量 `{ data: [...] }`（无 meta），前端两种都能消费；**新后端所有列表接口建议直接实现分页**，全量仅小表（员工/礼品）保留。
- 非 2xx 返回 `{ message: "可读错误文案" }`，前端直接 toast 该文案，请保证 message 面向管理员可读（不要抛异常堆栈）。
- 约定状态码：**401** 未登录/过期；**403** 无权限（越部门等）；**409** 业务冲突（重复审核、礼品重名、状态机非法流转等）；**404** 资源不存在。

### 1.3 列表排序硬规则
- 审核类列表（兑换订单/任务记录/积分申请/申诉）：**「待审核」置顶，同状态按申请/提交时间倒序**。前端有页面级兜底排序，但跨页排序必须由后端保证。

### 1.4 时间格式
- 时间点字段与展示：`yyyy-MM-dd HH:mm:ss`（全局统一）。
- 查询参数：月份 `YYYY-MM`；任务截止日 `YYYY-MM-DD`；投票开始/截止 `YYYY-MM-DD HH:mm`。

### 1.5 写操作通用要求
- 防重复提交由前端负责（按钮 loading + 提交锁），后端做幂等兜底。
- 所有写操作（含审核、上下架、同步、导出）写操作日志（见 3.13 log 域）。
- 备注必填校验是业务底线：单笔奖惩、批量录分、各类驳回，后端必须强校验 remark 非空。

### 1.6 文件上传/下载
- 上传：`multipart/form-data`，文件字段名固定 **`file`**（前端 uploadGiftCover）。
- 下载（Excel 导出）：GET 请求返回二进制流（xlsx），前端从响应取 Blob 保存；**文件名由前端拼接**（含 `yyyyMMddHHmmss` 时间戳），后端无需在 Content-Disposition 里处理文件名。

## 二、接口总览（42 个）

| # | 域 | 接口 | 状态 |
|---|---|---|---|
| 1 | auth | POST /admin/auth/login | 旧后端已实现，SpringBoot 重做 |
| 2 | auth | GET /admin/badges | 旧后端已实现；建议扩展四类计数（3.1） |
| 3 | auth | POST /admin/badges/mark-seen | 旧后端已实现 |
| 4 | employee | GET /admin/employees | 旧后端已实现；需增加双积分字段（3.2） |
| 5 | wecom | POST /admin/wecom/sync-contacts | mock；需真正对接企微（3.3） |
| 6 | points | POST /admin/points/adjustment | 旧后端已实现；需升级双积分语义（3.4） |
| 7 | points | POST /admin/points/monthly-batch | 旧后端已实现 |
| 8 | points | POST /admin/points/{id}/reverse | 旧后端已实现（冲正，前端常量预留） |
| 9 | report | GET /admin/reports/point-records | 旧后端已实现 |
| 10 | report | GET /admin/reports/point-records.xlsx | 旧后端已实现（个人明细导出） |
| 11 | report | GET /admin/reports/points-summary.xlsx | **新契约**（全员积分汇总导出，3.5） |
| 12 | mall | GET /admin/mall/gifts | 旧后端已实现 |
| 13 | mall | POST /admin/mall/gifts | 旧后端已实现；补名称唯一校验（3.6） |
| 14 | mall | PUT /admin/mall/gifts/{id} | 旧后端已实现 |
| 15 | mall | POST /admin/mall/gifts/{id}/publish | 旧后端已实现 |
| 16 | mall | POST /admin/mall/gifts/{id}/unpublish | 旧后端已实现 |
| 17 | mall | POST /admin/mall/gifts/{id}/cover | 旧后端已实现（multipart 字段 file） |
| 18 | order | GET /admin/orders | 旧后端已实现；状态收敛三态（3.7） |
| 19 | order | POST /admin/orders/{id}/status | 旧后端已实现 |
| 20 | order | GET /admin/orders.xlsx | **新契约**（兑换记录导出，3.5） |
| 21 | appeal | GET /admin/appeals | 旧后端已实现；状态归一三态（3.8） |
| 22 | appeal | POST /admin/appeals/{id}/review | 旧后端已实现；payload 归一（3.8） |
| 23 | application | GET /admin/applications | **mock 先行**（3.9） |
| 24 | application | POST /admin/applications/{id}/review | **mock 先行**（3.9） |
| 25 | task | GET /admin/tasks | **mock 先行**（3.10） |
| 26 | task | POST /admin/tasks | **mock 先行** |
| 27 | task | PUT /admin/tasks/{id} | **mock 先行** |
| 28 | task | POST /admin/tasks/{id}/publish | **mock 先行** |
| 29 | task | POST /admin/tasks/{id}/unpublish | **mock 先行** |
| 30 | task | POST /admin/tasks/{id}/delete | **mock 先行** |
| 31 | task | GET /admin/task-records | **mock 先行** |
| 32 | task | POST /admin/task-records/{id}/review | **mock 先行** |
| 33 | task | GET /admin/task-records.xlsx | **新契约**（3.5） |
| 34 | vote | GET /admin/votes | **mock 先行**（3.11） |
| 35 | vote | POST /admin/votes | **mock 先行** |
| 36 | vote | POST /admin/votes/{id}/update | **mock 先行** |
| 37 | vote | POST /admin/votes/{id}/close | **mock 先行** |
| 38 | vote | GET /admin/votes/{id}/stats | **mock 先行** |
| 39 | vote | GET /admin/votes/{id}/stats.xlsx | **新契约**（3.5） |
| 40 | rule | GET /admin/rules | **mock 先行**（3.12） |
| 41 | rule | PUT /admin/rules | **mock 先行**（3.12） |
| 42 | log | GET /admin/operation-logs | 旧后端已实现；建议扩展筛选参数（3.13） |

> 状态说明：**mock 先行** = 前端已按本文档契约开发并走 mock（`src/mock/<域>.ts` 即参考实现），SpringBoot 照契约实现后前端摘除 mock 即通；**新契约** = 全新导出接口，前端已直调，后端实现即通。

## 三、各域接口详情

### 3.1 认证与角标（auth 域）

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 登录 | `POST /admin/auth/login` | body: `{ username, password }` | `{ token, admin: AdminInfo }` | JWT 12h |
| 待办角标 | `GET /admin/badges` | — | `{ appealsUnread, ordersUnread }` | 顶栏角标 |
| 角标已读 | `POST /admin/badges/mark-seen` | body: `{ keys: string[] }` | — | 前端处理后调用 |

**AdminInfo**：`{ id, username, name, role: super_admin|hr_admin|department_admin, departmentIds?: number[] }`（部门管理员带管辖部门列表）。

**SpringBoot 建议一步到位（P2）**：badges 扩展为 `{ appealsUnread, ordersUnread, exchangePending, taskPending, applicationPending, appealPending }`（后四类=各审核 Tab 待审数）。当前前端用 4 个列表接口 `pageSize=1&status=待审` 拼 `meta.total`，后端给聚合后前端合并为 1 次请求。

**关联前端**：`src/api/auth/`、`src/views/Login.vue`、`src/App.vue`。

### 3.2 员工列表（employee 域）｜P0

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 员工列表 | `GET /admin/employees` | query: `page?, pageSize?`（可不传） | `Employee[]`（或 Paged） | 量级小，页面端做筛选/搜索 |

**Employee 字段契约**（`src/api/employee/types.ts`）：
`id, name, departmentId, departmentName?, wecomUserId?, pointsBalance, availablePoints?, cumulativePoints?, status: active|inactive`

**双积分硬要求（PRD 3.1 定稿，SpringBoot 直接实现、无过渡）**：
- `availablePoints` **可用积分**：当前可兑换余额；兑换礼品、管理员扣分会扣减。
- `cumulativePoints` **累计积分**：终身累计荣誉分；**只增不减，仅管理员人工扣分可减少**，兑换消耗不扣减；用于荣誉排名。
- 旧 `pointsBalance` 可保留为冗余字段（=可用积分），前端以双积分字段优先。
- 初始员工（企微同步入库）双积分均为 0。
- **禁用（inactive）员工**：不可登录小程序、不可兑换、不可被勾选为投票参与人；历史流水保留。

**部门权限**：department_admin 只返回本部门员工。

### 3.3 企微通讯录同步（wecom 域）｜P0 数据源头

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 一键同步 | `POST /admin/wecom/sync-contacts` | 无 body | `{ created, updated, disabled, total }` | 人数统计 |

**SpringBoot 按目标结构直接实现**（不做旧数组兼容——前端已预留切换）：
- 后端主动拉企微通讯录：获取部门列表 → 逐部门获取成员详情（需企微后台配置 corpsecret / 可信 IP / 可见范围）。
- 按 `wecomUserId` 增量 upsert：新员工入库（双积分 0）；在职员工更新姓名/部门；**离职/移出可见范围员工自动置 inactive**。
- 写操作日志 `wecom.contacts_synced`。
- 同步为重操作，建议进行中锁：重复触发返回 409 + message「同步进行中，请稍候」。
- 前端页面展示「本次同步：新增 x / 更新 y / 禁用 z，共 n 人」。

**关联前端**：`src/api/wecom/`、员工积分页「同步企微通讯录」按钮（`src/views/EmployeePoints.vue`）。

### 3.4 积分录入（points 域）｜P0

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 单笔奖惩 | `POST /admin/points/adjustment` | body: `{ employeeId, type: reward|penalty, pointsDelta(正数), remark }` | 新流水或 ok | **remark 必填，空直接 400** |
| 月度批量 | `POST /admin/points/monthly-batch` | body: `{ month(YYYY-MM), batchRemark, items: [{ employeeId, pointsDelta, remark }][] }` | ok | 统一备注+单人备注覆盖；remark 同样必填 |
| 冲正 | `POST /admin/points/{recordId}/reverse` | body: `{ remark }` | 新冲正流水 | 纠错唯一途径：生成一条反向流水，原流水不动 |

**业务规则（底线，不可妥协）**：
- **所有积分流水（point_records）创建后不可改不可删**：不提供 UPDATE/DELETE 接口；纠错只走冲正（`reversalOfId` 指向原流水）。建议数据库层加触发器兜底。
- 单笔语义（双积分）：**加分 → 双积分同加；人工扣分 → 双积分同扣**（这是唯一能减少累计积分的途径）。
- 流水类型 `type`：`reward`（人工加分）/ `penalty`（人工扣分）/ `performance`（任务奖励）/ `application`（积分申请到账）/ `exchange`（兑换消耗，只扣可用）/ `refund`（订单驳回退分，只回可用）/ `reversal`（冲正）。
- 每条流水必带完整 `remark`；写操作日志；推送员工通知（通知链路由后端自管，前端不感知）。
- 部门管理员仅可操作本部门员工。

**PointRecord 字段契约**（`src/api/report/types.ts`）：`id, employeeId, employeeName?, pointsDelta, type, operatorName?, occurredAt, remark, sourceType?, sourceId?, reversalOfId?`

**关联前端**：`src/api/points/`、`src/views/Points.vue`（单笔+批量）。

### 3.5 报表与数据导出（report 域）｜P0/P2

**职责边界（用户裁定）：导出文件一律由后端生成 Excel，前端不做任何文件拼装**，只负责筛选参数、触发下载、保存文件。

| 接口 | 方法/路径 | 请求 | 响应 | 说明 |
|---|---|---|---|---|
| 积分流水分页 | `GET /admin/reports/point-records` | query: `page?, pageSize?, employeeId?, month?(YYYY-MM)` | Paged\<PointRecord\> | 员工积分页流水抽屉用 |
| 个人积分明细导出 | `GET /admin/reports/point-records.xlsx` | query: `employeeId, month`（**均必填**） | xlsx 流 | 见导出矩阵 |
| 全员积分汇总导出 | `GET /admin/reports/points-summary.xlsx` | 无参数 | xlsx 流 | **新契约**，见导出矩阵 |
| 兑换记录导出 | `GET /admin/orders.xlsx` | query: `employeeId?, status?` | xlsx 流 | 新契约，见导出矩阵 |
| 任务审核记录导出 | `GET /admin/task-records.xlsx` | query: `status?` | xlsx 流 | 新契约，见导出矩阵 |
| 投票统计导出 | `GET /admin/votes/{id}/stats.xlsx` | 路径参数 id | xlsx 流 | 新契约，见导出矩阵 |

**导出矩阵（列口径 2026-10-10 用户定稿：前端要什么效果，后端照做，不得自行加减列）**：

| 数据表 | 导出列（定稿口径） |
|---|---|
| 全员积分数据表（points-summary.xlsx） | 每人一行：**姓名、可用积分、累计积分**（当前积分汇总，非流水） |
| 个人积分明细（point-records.xlsx） | 每条流水一行，**必须含完整备注**（PRD 核心规则） |
| 兑换记录表（orders.xlsx） | 每条兑换一行：**姓名、兑换商品、兑换时间**（yyyy-MM-dd HH:mm:ss） |
| 任务审核记录表（task-records.xlsx） | 每条任务记录一行：**任务领取人（姓名）、状态（进行中/待审核/已通过/已驳回）、任务名称、任务成果** |
| 投票统计数据表（votes/{id}/stats.xlsx） | 两个 sheet。①「投票统计」：**投票主题、选项、票数**（一行一选项），尾部合计行 + **最高票选项**行（选项名+票数；并列最高时以顿号连接全部列出）；②「参与明细」：**投票人、所选选项、提交时间** |

Excel 样例见 `docs/导出Excel模板/`（模板1-5，含表头样式与示例数据，后端照此产出）。

**关联前端**：`src/api/report/`、`src/views/Reports.vue`（数据导出页 5 卡）。

### 3.6 礼品商城（mall 域）｜P0

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 礼品列表 | `GET /admin/mall/gifts` | — | `Gift[]`（全量，含下架） | 下架礼品后台可见可管理，用户端隐藏 |
| 新增礼品 | `POST /admin/mall/gifts` | body: GiftPayload | `Gift` | 名称唯一校验（见下） |
| 编辑礼品 | `PUT /admin/mall/gifts/{id}` | body: GiftPayload | `Gift` | 同上 |
| 上架 | `POST /admin/mall/gifts/{id}/publish` | — | `Gift` 或 ok | |
| 下架 | `POST /admin/mall/gifts/{id}/unpublish` | — | `Gift` 或 ok | 用户端隐藏，历史订单保留 |
| 上传封面 | `POST /admin/mall/gifts/{id}/cover` | multipart 字段 `file`（≤5MB） | `Gift`（含 coverImageUrl） | 先保存礼品拿 id 再传封面 |

**字段契约**：Gift `{ id, name, pointsCost, stock, limitPerUser(number|null，null=不限购), status: active|inactive, coverImageUrl?, createdAt?, updatedAt? }`；GiftPayload 同名业务字段。

**业务规则**：
- **礼品名称唯一**（用户裁定）：不可重名，**范围含已下架礼品**，编辑排除自身；重名返回 **409 + message「礼品名称已存在（含已下架礼品）」**；建议数据库唯一索引。
- `createdAt`/`updatedAt` 必须返回（旧后端缺 createdAt，前端列表有空列）。
- `coverImageUrl` 存相对路径（如 `/uploads/xxx.png`），前端拼静态资源前缀。

**关联前端**：`src/api/mall/`、`src/views/Mall.vue`（含兑换记录抽屉走 order 域）。

### 3.7 兑换订单（order 域）｜P0

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 订单列表 | `GET /admin/orders` | query: `page?, pageSize?, status?, employeeId?` | Paged\<Order\> | 待审核置顶、时间倒序 |
| 审核订单 | `POST /admin/orders/{id}/status` | body: `{ status: approved|rejected, remark }` | ok | **驳回 remark 必填**；重复审核 409 |

**Order 字段契约**：`{ id, employeeId, employeeName?, giftId?, giftName, pointsCost, status, remark?, createdAt?, updatedAt? }`

**状态口径（PRD 定稿：兑换订单无发货环节，审核通过即终点）**：
- 管理端三态：`pending_review`（待审核）/ `approved`（审核通过，闭环）/ `rejected`（已驳回）。
- 旧后端的 `shipped/completed` 是历史概念，SpringBoot **不需要实现**；若员工端保留「取消订单」（`cancelled`），语义与驳回一致走退分。
- **驳回/取消必须自动生成退分流水**（type=refund，只回可用积分），写日志、通知员工。

**关联前端**：`src/api/order/`、审核中心「礼品兑换审核」Tab（`src/components/review/ExchangeReviewPanel.vue`）。

### 3.8 申诉工单（appeal 域）｜P1

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 申诉列表 | `GET /admin/appeals` | query: `page?, pageSize?, status?, employeeId?` | Paged\<Appeal\> | 待审核置顶 |
| 审核申诉 | `POST /admin/appeals/{id}/review` | body: `{ status: approved|rejected, resultRemark }` | ok | **resultRemark 必填**；重复审核 409 |

**Appeal 字段契约**：`{ id, employeeId, employeeName?, pointRecordId, pointRecord?(关联原流水，含备注), reason, status, resultRemark?, createdAt?, updatedAt? }`

**SpringBoot 直接实现 PRD 三态（一级审核，不做两级）**：
- 状态：`pending_review`（待审核）/ `approved`（审核通过）/ `rejected`（已驳回）。
- 旧后端五值两级流程（部门初审→人事复核）是废弃设计，**不要实现**；前端已做归一映射，后端三态就绪后前端同步切新 payload。
- 审核通过 → 若原流水为扣分则生成反向补分流水（写流水+日志+通知员工）；驳回 → 员工可见处理备注。
- 部门管理员仅本部门申诉可见可审；员工只能对自己的流水申诉（小程序端约束）。

**关联前端**：`src/api/appeal/`、审核中心「申诉工单处理」Tab（`src/components/review/AppealReviewPanel.vue`）。

### 3.9 积分申请（application 域）｜P1｜前端 mock 先行

员工在小程序自主申报贡献（分值+缘由+佐证图），管理员审核后双积分到账（PRD 4.6/5.2）。

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 申请列表 | `GET /admin/applications` | query: `page?, pageSize?, status?, employeeId?` | Paged\<Application\> | 待审核置顶 |
| 审核申请 | `POST /admin/applications/{id}/review` | body: `{ status: approved|rejected, remark }` | ok | 驳回 remark 必填；重复审核 409 |

**Application 字段契约**：`{ id, employeeId, employeeName?, points(正整数), reason(申请缘由), evidenceImages?(佐证图URL[]), status: pending_review|approved|rejected, reviewRemark?, reviewedBy?, createdAt, updatedAt }`

**业务规则**：审核通过 → 双积分同步到账（写流水 type=application + 日志 + 通知员工）；驳回 → 员工可发起申诉；部门管理员仅本部门可见可审。参考实现：`src/mock/application.ts`。

**关联前端**：`src/api/application/`、审核中心「积分申请审核」Tab。

### 3.10 任务管理（task 域）｜P1｜前端 mock 先行

管理员发布任务，员工领取→提交成果，管理员审核（PRD 5.5/5.2）。

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 任务列表 | `GET /admin/tasks` | query: `page?, pageSize?` | Paged\<Task\> | |
| 新增任务 | `POST /admin/tasks` | body: TaskPayload | `Task` | **默认已下架**，需手动上架 |
| 编辑任务 | `PUT /admin/tasks/{id}` | body: TaskPayload | `Task` | |
| 上架 | `POST /admin/tasks/{id}/publish` | — | ok | 上架后员工端任务大厅可见 |
| 下架 | `POST /admin/tasks/{id}/unpublish` | — | ok | 用户端隐藏，进行中记录保留 |
| 删除任务 | `POST /admin/tasks/{id}/delete` | — | ok | **员工领取记录保留（历史不删）**，需二次确认 |
| 任务记录 | `GET /admin/task-records` | query: `page?, pageSize?, status?, taskId?, employeeId?` | Paged\<EmployeeTask\> | 待审核置顶 |
| 成果审核 | `POST /admin/task-records/{id}/review` | body: `{ status: approved|rejected, remark }` | ok | 驳回 remark 必填；仅 pending_review 可审，重复 409 |

**Task 字段契约**：`{ id, name, description, rewardPoints(正整数), deadline(YYYY-MM-DD), requirement, status: published|unpublished, createdAt?, updatedAt? }`；TaskPayload 同名业务字段。

**EmployeeTask 字段契约**：`{ id, taskId, taskName?, rewardPoints?, employeeId, employeeName?, status: in_progress|pending_review|approved|rejected, submissionText?, submissionImages?[], submittedAt?, reviewedAt?, reviewRemark?, createdAt?, updatedAt? }`

**业务规则**：审核通过 → 奖励双积分到账（type=performance 流水+日志+通知）；驳回 → 员工可申诉；deadline 过后员工不可领取/提交（后端拦截）；任务名可重名（按批次发布，与礼品不同）；部门管理员仅本部门记录可见可审。参考实现：`src/mock/task.ts`。

**关联前端**：`src/api/task/`、`src/views/TaskManage.vue`、审核中心「任务积分审核」Tab。

### 3.11 投票管理（vote 域）｜P1｜前端 mock 先行

**硬约束（PRD 3.4-7）**：投票仅作管理员积分审核参考，**不自动加积分、不自动完成审核**；管理员看完统计仍需回审核中心人工处理。

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 投票列表 | `GET /admin/votes` | query: `page?, pageSize?, title?(模糊), status?(not_started/in_progress/ended)` | Paged\<Vote\> | 创建时间倒序；status 为推导状态（时间+closed 推导，非存储字段） |
| 新建投票 | `POST /admin/votes` | body: VotePayload | `Vote` | 校验：标题非空、≥2 选项、开始<截止、≥1 参与人 |
| 编辑投票 | `POST /admin/votes/{id}/update` | body: VotePayload | `Vote` | **仅未开始可编辑**，已开始 409 |
| 手动关闭 | `POST /admin/votes/{id}/close` | — | ok | 关闭后不可提交，视为已结束；已结束 409 |
| 投票统计 | `GET /admin/votes/{id}/stats` | — | `VoteStats` | 进行中/已结束可看；未开始 409 |
| 统计导出 | `GET /admin/votes/{id}/stats.xlsx` | — | xlsx 流 | 列口径见 3.5 导出矩阵 |

**Vote 字段契约**：`{ id, title, description, relatedType: ""|"task"|"application"（关联业务，空=普通调研）, relatedId?, relatedLabel?, voteType: single|multiple, options: [{id, text}], startTime("YYYY-MM-DD HH:mm"), endTime(同), participantIds: number[], participantNames?[], closed?, submittedCount?, createdBy?, createdAt?, updatedAt? }`

**VotePayload**：选项传纯文本数组 `options: string[]`（选项 ID 由服务端生成），其余同 Vote 业务字段。

**VoteStats**：`{ totalParticipants(应参与), submittedCount(实际提交), participationRate(0-100 整数), optionStats: [{text, votes, percent}][], details: [{employeeId, employeeName, selectedTexts: string[], submittedAt}] }`

**业务规则**：仅管理员可建/编/关；参与人为手动勾选的员工子集，未勾选员工小程序不可见；每人限投 1 次、提交后不可改（小程序端提交接口由小程序端提需求）；到期自动关闭；投票创建/编辑/关闭/导出/员工提交全部写「投票操作日志」（action：`vote.created/updated/closed/exported/submitted`，PRD 5.6 第 5 类）；到开始时间向参与员工推送通知（后端自管）。参考实现：`src/mock/vote.ts`。

**关联前端**：`src/api/vote/`、`src/views/VoteManage.vue`。

### 3.12 规则配置（rule 域）｜P1｜前端 mock 先行

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 获取规则 | `GET /admin/rules` | — | `{ content(富文本HTML), updatedAt?, updatedBy? }` | **用户端规则中心读取同一接口** |
| 保存规则 | `PUT /admin/rules` | body: `{ content }` | 更新后 RuleContent | 保存后即时生效，小程序无需发版 |

**业务规则**：后端原样存储 HTML（前端 wangeditor 产出，长度上限建议 100KB）；空内容前端已拦截；写日志 `rule.updated`。参考实现：`src/mock/rule.ts`。

**关联前端**：`src/api/rule/`、`src/views/RuleConfig.vue`、工作台「积分规则」卡。

### 3.13 操作日志（log 域）｜P2

| 接口 | 方法/路径 | 请求 | 响应 data | 说明 |
|---|---|---|---|---|
| 日志列表 | `GET /admin/operation-logs` | query: `page?, pageSize?, type?, startTime?, endTime?` | Paged\<OperationLog\> | 时间倒序 |

**OperationLog 字段契约**：`{ id, traceId?, action, actionText?, actorText?, businessSummary?, resultText?, createdAt, payload?(原始明细), targetLabel?, remark? }`

- **action 命名**：`<域>.<动作>`，如 `points.adjust`、`order.approved`、`appeal.reviewed`、`task.created`、`vote.created`、`wecom.contacts_synced`、`rule.updated`。
- `actionText`（中文动作）、`actorText`（操作人）由后端 enrich；前端按 action 前缀归类五类（积分操作/审核操作/申诉处理/礼品任务修改/投票操作，见 `src/utils/log-category.ts`）。
- `targetLabel`（操作对象）与 `remark`（备注详情）两字段后端 enrich 最佳；未 enrich 时前端从 payload 推导兜底。
- **建议扩展**（SpringBoot 一步到位）：`type` 筛选（points/review/appeal/gift_task/vote/system）+ `startTime/endTime` 时间范围。当前前端拉 pageSize=500 客户端筛选，后端就绪后切换。
- 日志**永久留存，无删改接口**。

**关联前端**：`src/api/log/`、`src/views/Logs.vue`。

## 四、实现优先级建议

1. **P0（先做，其他域依赖它）**：auth 登录/角标 → 企微通讯录同步（数据源头）→ 员工双积分字段 → 积分录入/冲正 → 礼品 → 订单审核。
2. **P1（审核中心三个新 Tab + 配套）**：积分申请、任务、投票、规则、申诉三态归一。
3. **P2（体验优化）**：日志筛选参数、badges 聚合计数、5 个 xlsx 导出接口。

后端每落地一个域，通知前端摘除对应 mock（`src/mock/<域>.ts` 删除 + `withMock` 直连真实接口），前端代码结构无需改动。
