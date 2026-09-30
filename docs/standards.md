# EasyPoints 项目规范

本文档约定本仓库的架构边界、业务底线、接口形态、编码与协作方式。实现细节以代码为准；业务规则与本文冲突时，以本文「不可违反」条款为准，并同步改代码与测试。

配套文档：

- 接口摘要：`docs/api.md`
- 部署：`docs/deployment.md`
- 管理员操作：`docs/admin-guide.md`
- 协作备忘：`AGENTS.md`

---

## 1. 项目定位

EasyPoints 是企业内部积分管理闭环：后台录分 → 员工查看明细与备注 → 申诉 → 商城兑换 → 订单核销 → 操作留痕。

仓库为 npm workspaces monorepo：

| 路径 | 职责 | 运行时 |
|---|---|---|
| `apps/api` | HTTP API、业务规则、Store | Node.js 原生 `http`（不依赖 Fastify 启动） |
| `apps/admin-web` | PC 管理后台 | Vue 3 + Vite + Element Plus |
| `apps/miniapp` | 员工端 | uni-app，目标企业微信小程序 |
| `infra` | Compose、MySQL schema/seed/migrations、Nginx | Docker |
| `docs` / `scripts` | 文档与本机启动脚本 | — |

两端前端只通过 HTTP 调用 `apps/api`，禁止在前端实现积分扣减、冲正、权限裁剪等业务规则。

---

## 2. 运行模式

### 2.1 本机开发（默认）

- Redis：`docker compose -f infra/docker-compose.yml up -d redis`
- API：`node apps/api/src/server.js` 或 `scripts/start-api-with-ai.ps1`
- 数据：未配置 MySQL，或 `FORCE_MEMORY_STORE=1` 时使用内存 Store
- 管理后台：`apps/admin-web` 下 `npm run dev`（默认 5173）
- **员工端小程序**（`apps/miniapp`，不进 Docker）：见 2.3

### 2.2 完整 Docker

`infra/docker-compose.yml` 中 MySQL、容器 API、Nginx 使用 profile `full`。这一栈**没有**小程序容器：小程序是企业微信端编译产物，Compose 只提供它要调用的 API。

```bash
docker compose -f infra/docker-compose.yml --profile full up -d
```

- MySQL 映射 `3307:3306`
- API `3000`，Nginx `8088`（反代 `/miniapp/` 到 API，不托管小程序包）
- 首次库初始化执行 `infra/mysql/schema.sql` 与 `seed.sql`

已有库的字段变更必须走 `infra/mysql/migrations/`，禁止改历史 schema 后指望自动重跑。

### 2.3 员工端小程序（`apps/miniapp`）

技术栈：uni-app（Vue 3），编译目标为企业微信 / 微信小程序，不是 H5 后台。

本机：

```bash
cd apps/miniapp
npm run dev:mp-weixin
```

用微信开发者工具打开编译输出目录（一般为 `apps/miniapp/dist/dev/mp-weixin`，以实际构建为准）。也可 `npm run dev:h5` 做页面联调。

- 请求基址：`uni storage` 的 `apiBase`，未配置时默认 `http://localhost:3000`
- 登录：`POST /miniapp/auth/login`，token 存 `employeeToken`
- 生产上传：`npm run build:mp-weixin` 后提交企业微信小程序，并配置服务器合法域名指向 API（或 Nginx 的 `/miniapp/`）

---

## 3. 目录与职责

### 3.1 API（`apps/api/src`）

| 文件 | 允许改什么 | 不要把什么塞进去 |
|---|---|---|
| `server.js` | 端口、读 `.env`、可选 outbox worker | 业务规则 |
| `app.js` | 路由、鉴权入口、HTTP 适配 | 复杂领域计算 |
| `http.js` | JSON 响应、JWT 解析、开发态 header 身份 | 业务判断 |
| `jwt.js` | HS256 签发/校验 | 业务字段含义之外的逻辑 |
| `data/store.js` | 持久化适配（memory / mysql） | 权限、备注校验（放 services） |
| `data/seed.js` | 内存模式示例数据 | 生产密码 |
| `services/*.js` | 领域规则 | 直接操作 `req`/`res` |
| `tests/*.js` | 行为回归 | 依赖真实网络或真实 MySQL（默认强制内存） |

新增能力时：先 services → 再 app 路由 → 再补测试 → 最后改前端。

### 3.2 管理后台

- 页面放 `src/views/`，路由登记在 `src/router.js`
- 所有接口走 `src/api.js`，不要在页面里散写 `fetch` URL
- 401 / token 过期必须清登录态并回登录页

### 3.3 员工端小程序（`apps/miniapp`）

| 路径 | 职责 |
|---|---|
| `pages.json` | 页面注册、TabBar、导航样式；新页面必须先登记 |
| `api.js` | 唯一请求封装：基址、JWT、401 重登、GET 缓存 |
| `App.vue` / `main.js` | 应用入口 |
| `manifest.json` / `project.config.json` | uni / 微信工程配置（含 appid） |
| `components/` | 跨页组件（如 `AiFloatBall.vue`） |
| `pages/*` | 业务页面，见下表 |

Tab（底栏）：

| 页面 | 标题 |
|---|---|
| `pages/home/index` | 首页（积分、本月变动、通知数） |
| `pages/hall/index` | 大厅（全员积分变动，仅 PC 侧来源） |
| `pages/leaderboard/index` | 排行榜 |
| `pages/points/index` | 积分明细（按月，完整备注） |
| `pages/mall/index` | 积分商城 |

独立页：`pages/ai/index`（AI 助手）、`pages/messages/index`（通知）、`pages/orders/index`（我的订单）、`pages/appeal/index`（申诉，必须绑定本人流水）。

约定：

- 所有接口走 `api.js`，不要在页面里散写 URL
- 401 自动重新登录并重试一次
- 首页调试设置默认隐藏，连续点击「展开设置」区域 7 次才启用（`enableDebug=1`）
- 明细必须展示后端返回的完整 `remark`，前端不得改写或省略

---

## 4. 编码约定

### 4.1 通用

- 源码与文档使用 UTF-8。PowerShell 读中文文件用 `Get-Content -Encoding UTF8`。
- 后端 CommonJS（`require`/`module.exports`）；admin-web 为 ESM。
- 标识符用英文 camelCase；用户可见文案用中文。
- 错误信息面向使用者，写入 `Error.message`，需要时设 `error.statusCode`。
- 不要引入与现有栈平行的第二套框架（例如不要把 API 改成必须 Fastify 才能启动）。
- `mysql2`、`xlsx` 等可选依赖：允许懒加载；缺依赖时给出明确 503，不要让进程在 `require` 阶段崩溃。

### 4.2 后端分层

```
路由 (app.js) → 领域服务 (services) → Store (data/store.js)
```

- 写操作涉及积分、订单、库存时，必须走 `store.transaction`（MySQL 下保证原子；内存模式同样走同一接口）。
- Store 只负责存取与表结构映射；「能不能改这条流水」由 services 与数据库触发器共同保证。
- 身份：生产环境只认 `Authorization: Bearer`。`x-admin-id` / `x-employee-id` 仅非 production 调试。

### 4.3 管理后台与小程序（前端共性）

- 列表分页参数统一 `page`、`pageSize`。
- 成功 JSON：有分页时 `{ data, meta }`；无分页时可 `{ data }` 或登录等特例顶层字段（如 `{ token, admin }`）。
- 失败 JSON：`{ message }`，HTTP 状态码表达类型（400 校验、401 未登录、403 无权限、404 不存在）。
- 不要在前端「补」备注或改流水展示语义；明细必须展示后端返回的完整 `remark`。
- 管理后台走 `/admin/*`；**小程序只走 `/miniapp/*`**，不要混用管理端接口。
- 小程序新增页面：先改 `pages.json`，再加 `pages/<name>/index.vue`，Tab 页还需改 `tabBar.list`。

### 4.4 Git 与密钥

- `.env` 不入库；以 `.env.example` 为模板。
- 禁止提交真实 `JWT_SECRET`、数据库密码、企微 secret、DeepSeek Key。
- 忽略：`node_modules/`、`dist/`、日志、`unpackage/`。

---

## 5. HTTP 与 API 规范

### 5.1 路径前缀

| 前缀 | 调用方 | 鉴权 |
|---|---|---|
| `GET /health` | 探活 | 无 |
| `/admin/*` | 管理后台 | 管理员 JWT（`typ=admin`） |
| `/miniapp/*` | 员工端 | 员工 JWT（`typ=employee`） |
| `/uploads/*` | 静态上传 | 按现有实现 |
| `/api/*` | Nginx 反代剥前缀后转到 API | 与原路径相同 |

新增接口必须落在 `/admin` 或 `/miniapp`，不要发明第三套前缀，除非同步改 Nginx。

### 5.2 鉴权

- 登录：`POST /admin/auth/login`、`POST /miniapp/auth/login`
- JWT payload：`typ`、`sub`（主体 id 字符串）、管理员另含 `role`；过期默认 12 小时
- `NODE_ENV=production` 时禁止 header 冒充身份

### 5.3 分页

- Query：`page`、`pageSize`
- 未传分页：管理端多数列表返回全量（兼容旧客户端）
- 传入分页：`{ data, meta }`，`meta` 含 `total`、`page`、`pageSize`（及实现提供的 `offset`）

### 5.4 禁止出现的接口

- 删除积分流水
- 修改积分流水的 `employeeId`、`pointsDelta`、`remark` 等核心字段
- 员工查询他人流水（除大厅等产品已定义的全员公开视图外）
- 未绑定本人流水的申诉创建

纠错只允许：`POST /admin/points/{id}/reverse` 生成反向流水。

接口清单以 `docs/api.md` 为摘要，实现以 `app.js` 为准。

---

## 6. 业务规则（不可违反）

### 6.1 备注

- 任何积分变动必须带非空备注（trim 后长度 > 0）。
- 单笔奖惩无备注 → 400，文案明确要求填写原因。
- 月度批量：统一 `batchRemark`，单人 `remark` 覆盖统一备注。
- 员工端明细、报表、Excel 导出必须带完整备注。
- 后端不提供修改或删除备注的能力。

### 6.2 流水不可篡改

- `point_records` 创建后核心字段不可改。
- Schema 触发器禁止对该表 `UPDATE` / `DELETE`。
- 纠错：新增冲正流水，`reversalOfId` 指向原记录，备注说明原因。
- 代码中不可变字段与 `points.js` 的 `immutableFields` 保持一致。

### 6.3 权限

| 角色 | 范围 |
|---|---|
| `super_admin` / `hr_admin` | 全局 |
| `department_admin` | 仅 `departmentIds` 内员工 |
| 员工 | 仅本人流水、申诉、订单 |

读接口要裁剪范围；写接口（录分、审申诉、改订单）必须 `requireManageEmployee` 或等价校验。礼品管理仅超管/人事。

实现入口：`apps/api/src/services/permissions.js`。

### 6.4 商城与订单

- 兑换：扣积分 + 生成订单，同一事务。
- 驳回 / 取消：退分必须再写一条退分流水，不得改原扣分流水。
- 状态变更写操作日志，并进入 message outbox。

### 6.5 员工 AI 助手

实现：`apps/api/src/services/employee-ai.js`。

- 入口：`POST /miniapp/ai/ask`
- 只根据**当前登录员工**的流水、余额、上架礼品回答，禁止编造、禁止答无关话题。
- `DEEPSEEK_API_KEY` 为空：规则引擎 `answerEmployeeQuestion`（`source: "rules"`）。
- Key 非空：先调 DeepSeek；失败回退规则引擎，可附 `notice`。
- 占位值 `your-deepseek-api-key` 会被当成已配置，应使用真实 Key 或留空。
- 规则问答与 DeepSeek 提示词变更后，更新 `apps/api/tests/employee-ai.test.js`。

---

## 7. 数据规范

### 7.1 字符集

MySQL 使用 `utf8mb4` / `utf8mb4_0900_ai_ci`。连接后执行 `SET NAMES utf8mb4`。

### 7.2 核心表

`departments`、`employees`、`admins`、`admin_departments`、`point_records`、`appeals`、`gifts`、`orders`、`operation_logs`、`message_outbox`、`admin_seen`。

以 `infra/mysql/schema.sql` 为准。新增表或字段：

1. 改 schema（仅空库/新环境）
2. 补 `infra/mysql/migrations/YYYYMMDD_描述.sql`
3. 同步 `store.js` 的 memory 与 mysql 两条路径
4. 需要时更新 seed

### 7.3 种子数据

- `infra/mysql/seed.sql` 与 `apps/api/src/data/seed.js` 语义对齐（部门、示例员工、礼品）。
- 内存模式默认管理员口令见 `seed.js`（开发用）。生产必须替换 `seed.sql` 中的密码哈希，禁止沿用示例口令。

---

## 8. 环境变量

根目录 `.env` 由 `server.js` 加载：仅当进程环境中该键未设置时写入。脚本里先 `export`/`$env:` 的值优先。

| 变量 | 含义 |
|---|---|
| `NODE_ENV` | `production` 关闭 header 调试身份 |
| `API_PORT` | 默认 3000 |
| `JWT_SECRET` | 生产必须替换 `change-me` |
| `MYSQL_HOST` 等 | 配置且无 `FORCE_MEMORY_STORE` 则用 MySQL |
| `FORCE_MEMORY_STORE=1` | 强制内存 |
| `REDIS_URL` | 预留；当前核心路径可不依赖 Redis |
| `ENABLE_OUTBOX_WORKER` | `1` 时定时派发 |
| `OUTBOX_*` | 批大小、重试、超时回收 |
| `WECOM_*` | 企微；未接真实 API 前为 mock |
| `DEEPSEEK_*` | 员工助手；Key 空则规则问答 |
| `UPLOAD_DIR` / `UPLOAD_MAX_BYTES` | 上传 |

Compose 内 API 的 `MYSQL_HOST` 必须是服务名 `mysql`，端口 `3306`。本机连容器 MySQL 用 `127.0.0.1:3307`。

---

## 9. 测试规范

- 命令：`node --test apps/api/tests`（Windows 不要依赖 shell glob）。
- 测试文件开头设置 `FORCE_MEMORY_STORE=1`，不连真实库。
- 改积分、权限、订单退分、outbox、员工 AI，必须改或补 `apps/api/tests/`。
- 覆盖底线（已有用例不可无故删）：备注必填、部门越权、本人申诉、流水不可改、退分流水、outbox 重试与超时回收。
- 提交前至少跑通 API 测试。前端变更应手工过对应页面与鉴权失效路径。

---

## 10. 部署与运维

详见 `docs/deployment.md`。规范要点：

- 生产替换 JWT、DB 密码、seed 密码；MySQL/Redis 不暴露公网。
- Nginx 配 HTTPS；`/health` 作为探活。
- Outbox：业务先写表再发送；失败重试，超限 `failed`；管理端可单条/批量重试。
- 备份至少包含 MySQL 与 `point_records` 长期归档。
- 企微：可信域名、业务域名、`corpId` / `agentId` / `secret`；当前同步与发送仍为骨架，上线前不得假装已接通。
- **小程序不随 Compose 发布**：构建 `apps/miniapp` 后上传企业微信后台；客户端把 `apiBase` 指到公网 API。Nginx 的 `/miniapp/` 只反代员工端 API，不是小程序静态包。

本机网络拉不满 Docker Hub 时，不要阻塞开发：使用 Redis + 本机 API + 内存 Store，完整镜像放到网络可用后再 `--profile full`。

---

## 11. 协作流程

1. 改积分相关：先读 `services/points.js` 与 `tests/points.test.js`。
2. 新积分变动类型：同时考虑**小程序**展示（首页/明细/大厅）、报表/导出、操作日志、outbox 文案。
3. 不新增修改/删除流水或备注的接口，不绕过 `assertRemark`。
4. 不移除 `point_records` 的不可变触发器。
5. 中文内容保持 UTF-8。
6. **禁止**批量删除目录（`del /s`、`rd /s`、`Remove-Item -Recurse`）。必须删除时一次只删一个明确文件路径；批量删除交由用户手动处理。

评审时优先看：是否破坏流水不可变、备注必填、部门隔离、事务边界、测试是否更新。

---

## 12. 已知缺口（改规范时一并跟踪）

- 企微免登、通讯录、真实发消息未完成（mock + outbox）。
- Outbox 尚无完整 sent/failed 原因、DLQ 与指标。
- 大表导出未流式/异步化。
- 生产密钥管理、限流、审计采集待补。

新增功能若触及以上缺口，应在 PR 说明是「骨架延续」还是「生产闭环」，避免把 mock 当成已交付。
