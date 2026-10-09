# admin-web 前端接口需求清单

> 用途：admin-web 改造期间，前端（mock 先行）与后端团队的接口对齐依据。后端每落地一项，前端摘除对应 mock 切换真实接口。
> 约定：本文档按业务域组织，与前端 `apps/admin-web/src/api/<域>/types.ts` 一一对应——**types.ts 即各接口的类型契约，字段命名以类型文件为准**。

## 一、通用约定

- 鉴权：`Authorization: Bearer <JWT>`（`POST /admin/auth/login` 签发，12h）；开发环境无 token 时前端发 `x-admin-id` 冒充头（生产禁用）。
- 响应：裸 JSON。单对象/数组返回 `{ data: ... }`；分页返回 `{ data: [...], meta: { total, page, pageSize } }`。
- 错误：非 2xx 返回 `{ message: "可读错误文案" }`，前端直接 toast 该文案。
- **列表默认排序**：审核类列表（兑换/任务/积分申请/申诉）**「待审核」工单必须置顶**，同状态按申请/提交时间倒序返回。
- 所有写操作要求：防重复提交由前端负责，后端做幂等兜底；写操作一律记操作日志（操作人/时间/对象/内容）。

## 二、现状已对接（无需后端改动）

登录/角标（auth）、员工列表（employee）、积分录入（points）、积分报表+Excel 导出（report）、礼品管理（mall）、订单（order）、申诉（appeal）、操作日志（log）——均已在 `src/api/` 各域对接现有后端。

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

**术语口径（PRD 3.1，2026-10-08 定稿）**：展示名统一用「**可用积分**」「**累计积分**」。

- 员工对象需增加双积分字段：`availablePoints`（**可用积分**=当前可兑换余额；兑换礼品、管理员扣分会扣减）、`cumulativePoints`（**累计积分**=终身累计荣誉分；**只增不减，仅管理员人工扣分可减少**，兑换消耗不扣减；用于荣誉排名/贡献统计）。
- 现有 `pointsBalance` 保留过渡，双积分落地后前端切换为双列展示。
- `POST /admin/points/adjustment` 语义同步升级：**加分 → 双积分同加；人工扣分 → 双积分同扣**（唯一能减少累计积分的途径）；兑换仅扣可用积分。备注必填不变。
- 到账规则：任务审核通过、积分申请审核通过、管理员加分 → 双积分同步增加。标准示例：初始 累计1000/可用1000，兑换消耗 200 → 累计1000 / 可用800。
- 详细计算规则见 PRD 3.1，前端各页面（员工积分/工作台/报表）在阶段 2 按此改造。

### 3.3 积分申请（application 域）｜优先级：P1｜前端已 mock 先行

**现状**：后端无此模块，前端走 mock（`src/mock/application.ts` 即实现目标，数据结构见 `src/api/application/types.ts`）。

| 接口 | 方法/路径 | 说明 |
|---|---|---|
| 申请列表 | `GET /admin/applications?page=&pageSize=&status=&employeeId=` | 分页返回 `{ data, meta }`；status ∈ pending_review/approved/rejected |
| 审核申请 | `POST /admin/applications/{id}/review` | body: `{ status: "approved"|"rejected", remark }`；驳回 remark 必填；已处理工单重复审核返回 409 + message |

**字段契约**（Application）：`id, employeeId, employeeName, points(正整数), reason(申请缘由), evidenceImages[](佐证图片URL), status, reviewRemark, reviewedBy, createdAt, updatedAt`。

**业务规则**：
- 审核通过 → 员工双积分同步到账（实时+实际），写积分流水（type 建议新增 `application` 或复用 `reward` + sourceType 标记），推送员工通知，入 outbox。
- 驳回 → 员工可对该驳回发起申诉（PRD 3.3）；写审核日志。
- 权限：部门管理员仅本部门申请可见可审（与其他审核接口一致）。

**关联前端文件**：`src/api/application/application.ts`、`src/views/Applications.vue`

### 3.4 申诉状态机归一（appeal 域）｜优先级：P1｜阶段 3 联调时落地

**现状**：存量后端申诉为五值（pending_department_review / pending_hr_review / department_approved / hr_approved / rejected），「部门初审→人事复核」两级流程为旧前端约定，**PRD 3.2/3.3 无两级审核**。后端 `reviewAppeal` 实际是任意状态直写，未强制流转顺序。

**需求**：状态机归一为 PRD 三态：
- 状态值：`pending_review`（待审核）/ `approved`（审核通过）/ `rejected`（已驳回），一级审核、处理后闭环。
- 列表接口 `GET /admin/appeals` 的 `status` 参数支持逗号分隔多值（如 `status=pending_review,pending_hr_review`），过渡期前端用旧值 `pending_department_review` 单值筛选兼容。
- 历史数据迁移：`pending_hr_review→pending_review`、`department_approved/hr_approved→approved`（或后端查询层做等价映射，二选一）。
- 前端已完成兼容：显示层把五值归一映射为三态（utils/status.ts APPEAL_STATUS_MAP），操作仍发旧值，后端归一后前端切换新值即可。

### 3.5 任务管理（task 域）｜优先级：P1｜前端已 mock 先行

**现状**：后端无此模块，前端走 mock（`src/mock/task.ts` 即实现目标，数据结构见 `src/api/task/types.ts`）。

| 接口 | 方法/路径 | 说明 |
|---|---|---|
| 任务列表 | `GET /admin/tasks?page=&pageSize=` | 分页返回 `{ data, meta }` |
| 新增任务 | `POST /admin/tasks` | body: `{ name, description, rewardPoints, deadline(YYYY-MM-DD), requirement }`；**默认已下架**，上架后员工端可见 |
| 编辑任务 | `PUT /admin/tasks/{id}` | 同新增 body |
| 上架/下架 | `POST /admin/tasks/{id}/publish`、`/unpublish` | 下架对用户端隐藏，进行中记录保留 |
| 删除任务 | `POST /admin/tasks/{id}/delete` | 员工领取记录保留（历史不删） |
| 员工任务记录 | `GET /admin/task-records?page=&pageSize=&status=&taskId=&employeeId=` | status ∈ in_progress/pending_review/approved/rejected |
| 任务成果审核 | `POST /admin/task-records/{id}/review` | body: `{ status: "approved"\|"rejected", remark }`；驳回 remark 必填；仅 pending_review 可审，重复审核 409 |

**字段契约**：Task `{ id, name, description, rewardPoints, deadline, requirement, status: published\|unpublished, createdAt, updatedAt }`；EmployeeTask `{ id, taskId, taskName, rewardPoints, employeeId, employeeName, status, submissionText, submissionImages[], submittedAt, reviewedAt, reviewRemark, createdAt, updatedAt }`。

**业务规则**：员工领取→进行中→提交成果（文字+图片）→待审核→通过/驳回；通过→奖励积分双积分到账（同 3.3 逻辑，写流水+通知+outbox）；驳回→可申诉；有效期到期不可领取/提交；部门管理员仅本部门记录可见可审；所有操作写日志。

**关联前端文件**：`src/api/task/task.ts`、`src/views/TaskManage.vue`、`src/components/review/TaskReviewPanel.vue`

### 3.6 审核中心聚合计数｜优先级：P2 优化

**现状**：审核中心四 Tab 的待办徽标由前端拼装——分别调兑换/任务/申请/申诉四个列表接口（`pageSize=1&status=待审核`）取 `meta.total`。已可用，无后端改动必须项。

**可选优化**：`GET /admin/badges` 扩展返回 `{ exchangePending, taskPending, applicationPending, appealPending }`，前端由 4 次请求合并为 1 次；同时顶栏角标从现有 appeals/orders 两类扩为四类。

### 3.7 投票管理（vote 域）｜优先级：P1｜前端已 mock 先行

**现状**：后端无此模块，前端走 mock（`src/mock/vote.ts` 即实现目标，数据结构见 `src/api/vote/types.ts`）。

**硬约束（PRD 3.4 第 7 条）**：投票仅作管理员审核参考，**不自动生成积分、不自动完成审核**；管理员看完统计仍需回到审核中心人工处理。

| 接口 | 方法/路径 | 说明 |
|---|---|---|
| 投票列表 | `GET /admin/votes?page=&pageSize=&title=&status=` | status 为推导状态：not_started/in_progress/ended（由时间+closed 推导）；按创建时间倒序；每行含 `submittedCount`（已提交人数） |
| 新建投票 | `POST /admin/votes` | body 见 VotePayload；服务端校验：标题非空、≥2 选项、开始<截止、≥1 参与人 |
| 编辑投票 | `POST /admin/votes/{id}/update` | **仅未开始可编辑**；已开始返回 409 |
| 手动关闭 | `POST /admin/votes/{id}/close` | 关闭后员工不可提交，状态视为已结束；已结束返回 409 |
| 投票统计 | `GET /admin/votes/{id}/stats` | 返回 VoteStats：应参与/实际参与/参与率/每选项票数占比/人员明细；未开始返回 409 |
| 统计导出 | `GET /admin/votes/{id}/stats.xlsx` | Excel 含投票信息+选项统计+明细；前端当前 CSV 兜底，后端就绪后切换 |

**字段契约**：Vote `{ id, title, description, relatedType(""|"task"|"application"), relatedId, relatedLabel, voteType("single"|"multiple"), options[{id,text}], startTime, endTime("YYYY-MM-DD HH:mm"), participantIds[], participantNames[], closed, submittedCount, createdBy, createdAt, updatedAt }`。

**业务规则**：仅管理员可建/编/关；参与人为手动勾选的员工子集，未被勾选员工不可见；每人限投 1 次、提交后不可改（小程序端约束）；到期自动关闭；投票创建/编辑/关闭/导出/员工提交全部写「投票操作日志」（PRD 5.6 第 5 类）；到开始时间自动向参与员工推送通知（走 outbox）。

**关联前端文件**：`src/api/vote/vote.ts`、`src/utils/vote.ts`（状态推导/校验/CSV）、`src/views/VoteManage.vue`

### 3.8 规则配置（rule 域）｜优先级：P1｜前端已 mock 先行

**现状**：后端无此模块，前端走 mock（`src/mock/rule.ts` 即实现目标）。

| 接口 | 方法/路径 | 说明 |
|---|---|---|
| 获取规则 | `GET /admin/rules` | 返回 `{ data: { content(富文本HTML), updatedAt, updatedBy } }`；**用户端规则中心读取同一接口**，保存后即时生效、无需小程序发版 |
| 保存规则 | `PUT /admin/rules` | body: `{ content }`；返回更新后的 RuleContent |

**业务规则**：富文本由前端 wangeditor 产出（后端存储原样 HTML，长度上限建议 100KB）；内容为空时前端拦截保存；建议每次保存写操作日志 `rule.updated`（归入系统操作类）。

**关联前端文件**：`src/api/rule/rule.ts`、`src/views/RuleConfig.vue`

### 3.9 后续章节（随阶段推进补充）

- 3.9 全套 Excel 导出 + 日志分类筛选扩展（含日志按时间范围筛选、五类日志类型筛选）——阶段 6
