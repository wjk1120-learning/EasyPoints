# AGENTS.md - EasyPoints 项目协作说明

## 1. 项目概览

本项目是“企业微信积分系统”的 monorepo：

- 后端 API：`apps/Easy-Points`（Java/SpringBoot，Docker 编排部署）
- PC 管理后台：`apps/admin-web`
- 员工端：`apps/miniapp`（uni-app 编译 H5，企微自建应用内打开的网页应用，**不是小程序**）
- 基础设施与部署：`infra`
- 项目文档：`docs`

项目目标是实现企业内部积分管理闭环：后台人工录入积分、员工查看积分明细和备注、员工申诉、积分商城兑换、订单审核核销、数据报表导出、全程操作留痕。

## 2. 当前技术栈

- 后端：Java/SpringBoot（`apps/Easy-Points`，MyBatis mapper + Lombok），Docker Compose 编排（app 监听 127.0.0.1:3000）。
- 管理后台：Vue 3 + Vite + Element Plus。
- 员工端：uni-app 编译 H5（企微自建应用内网页应用，与小程序无关）。
- 数据库：MySQL 8；缓存/队列：Redis。
- 部署：Docker Compose + Nginx，默认单服务器部署。
- 前后端唯一接口契约：`docs/Easy-Points-API.md`（v4.3），改接口先对契约。

## 3. 关键业务规则

### 积分备注是核心需求

- 所有积分变动都必须和备注绑定。
- 单笔奖惩积分必须填写备注，否则后端拒绝提交。
- 月度批量录分支持统一备注，也支持单个员工备注覆盖统一备注。
- 员工端积分明细必须展示每条流水的完整备注。
- 报表导出需要包含每条流水的备注。

### 积分流水不可篡改

- 后端不提供积分流水删除接口。
- 后端不提供积分流水备注修改接口。
- `point_records` 创建后，`employeeId`、`pointsDelta`、`remark` 等核心字段不可改。
- 如需纠错，必须新增一条反向“冲正流水”，不能修改原流水。
- 数据库 schema 中对 `point_records` 设置了禁止 `UPDATE` 和 `DELETE` 的触发器。

### 权限隔离

- 超级管理员和人事管理员拥有全局权限。
- 部门管理员只能管理本部门员工。
- 员工只能查看自己的积分流水。
- 员工只能针对自己的积分流水提交申诉。

### 商城与订单

- 员工兑换礼品时扣减积分并生成订单。
- 订单驳回或取消时，通过退分流水返还积分。
- 订单状态变化会写入操作日志，并进入消息 outbox。

## 4. 重要目录说明

### `apps/Easy-Points`

Java 后端（生产后端，Docker 编排：app + MySQL + Redis + Nginx）。

- `src/main/java/com/yidian/easypoints/`：按模块分包（auth/point/appeal/mall/task/application/vote/rule/notification/wecom/system 等）。
- `src/main/resources/db/`：MySQL schema 与初始化脚本（point_records 有禁 UPDATE/DELETE 触发器）。
- `docker-compose.yml` / `docker-compose.override.yml`：部署编排；override 切 dev profile（本地联调允许直登）。

### `apps/admin-web`

Vue 管理后台（已按 `docs/Easy-Points-API.md` 契约完成整体迁移，api 层为 `src/api/<功能域>/` 结构）。

### `apps/miniapp`

员工端（uni-app 编译 H5；**企微自建应用内网页应用，不是小程序**）。

- `utils/request.ts`：请求内核（BaseResult 解包 / PageResult 归一 Paged / 无 token 先登录 / 401 重登重试 / GET 离线缓存）。
- `api/<功能域>/`：域目录 = `types.ts` 纯类型 + 域函数 + `XxxApi` 路径常量，页面直连域函数（与 admin-web 同构，无桶文件）。
- `pages/`：11 个页面全部 TS 并已切新后端契约（home/points/leaderboard/mall/orders/appeal/appeals/tasks/apply/messages+message/votes+vote/rules/mine）。
- `api/auth/auth.ts`：登录与 `ensureEmployeeLogin()` 编排——企微内走 OAuth 网页授权免登，浏览器联调 dev 直登 zhangsan。
- `tests/`：vitest 四层（unit / contract / components / `scripts/h5-e2e.py` 浏览器冒烟），uni-stub 注入 uni API。
- 工具链坑：vue 锁 3.4.21（uni alpha 配套）、根 `scripts/patch-uni-h5-vue.cjs` 修 H5 白屏（挂 postinstall）、H5 走 vite 代理防 CORS。

### `infra`

部署和数据库。

- `docker-compose.yml`：MySQL、Redis、API、Nginx 单机部署编排。
- `mysql/schema.sql`：数据库结构，包括积分流水不可改删触发器。
- `mysql/seed.sql`：初始化部门、员工、管理员、礼品。
- `nginx/default.conf`：Nginx 反向代理配置。

### `docs`

- `api.md`：接口摘要。
- `deployment.md`：部署说明。
- `admin-guide.md`：管理员操作说明。

## 5. 常用命令

一键启动本地环境（后端 Docker + 管理后台，`-H5` 额外启动员工端）：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1 -H5
```

员工端（在 `apps/miniapp` 下执行）：

```bash
npm run dev:h5     # H5 联调（http://localhost:5174，vite 代理转发后端 3000）
npm run build:h5   # H5 生产构建（产物 dist/build/h5）
npm test           # vitest 全量（unit/contract/components）
npm run typecheck  # vue-tsc
python scripts/h5-e2e.py   # 员工端浏览器冒烟（需 dev:h5 与后端已启动）
```

后端（在 `apps/Easy-Points` 下执行）：`docker compose up -d` / `docker compose stop`；健康检查 `GET http://localhost:3000/health`。后端的环境变量与 profile 以 `apps/Easy-Points/docker-compose.yml`（及 override）为准。

注意：当前机器曾出现 `npm` 不可用的情况，因此不要假设 npm 已安装或可直接调用。若要安装前端依赖或执行 Vite/uni-app 构建，需要先确认 npm/pnpm/yarn 环境。

### 5.1 常用环境变量（生产/联调）

- `NODE_ENV=production`：启用更严格的鉴权（禁止用 header 冒充身份）。
- `JWT_SECRET`：JWT 签名密钥，生产必须替换默认值。
- `API_PORT`：后端端口（默认 3000）。

### 5.2 MySQL 持久化开关

后端 store 支持 memory/mysql 双模式：

- 默认：未配置 MySQL 时使用内存 store（便于本地快速跑通与测试）。
- 配置 `MYSQL_HOST` 且未设置 `FORCE_MEMORY_STORE` 时自动切到 MySQL store。

常用 MySQL 环境变量：

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `FORCE_MEMORY_STORE=1`：强制使用内存 store（用于测试/排障）。

### 5.3 Outbox/消息派发相关

- `ENABLE_OUTBOX_WORKER=1`：启动时开启定时派发（可选）。
- `OUTBOX_INTERVAL_MS`：worker 轮询间隔（默认 5000ms）。
- `OUTBOX_BATCH_SIZE`：单次认领/派发条数（默认 50）。
- `OUTBOX_MAX_RETRIES`：失败重试上限（默认 3）。
- `OUTBOX_PROCESSING_TIMEOUT_SEC`：processing 超时回收（默认 60 秒）。
- `WECOM_MOCK_FAIL=1`：模拟派发失败（用于验证重试链路）。

## 6. 已有测试覆盖

`apps/api/tests/points.test.js` 当前覆盖：

- 单笔加减分必须填写备注。
- 月度批量录分支持统一备注和单人备注覆盖。
- 部门管理员不能操作非本部门员工。
- 员工只能申诉自己的积分流水。
- 积分流水创建后不可修改。
- 员工积分明细返回完整备注。
- 订单驳回退回积分并生成退分流水。
- outbox：积分变动入队、派发后状态更新、失败重试与超限失败、processing 超时回收、批量重试失败消息。
- 权限：部门管理员不能审核其它部门申诉、不能处理其它部门订单。

## 7. 当前实现状态与后续重点

> 本节部分内容基于早期骨架撰写，后端与 admin-web 的最新现状以各自仓库内文档为准；员工端现状见 7.4。

### 7.1 已落地（当前代码已具备）

- 后端持久化：`apps/api/src/data/store.js` 支持 memory/mysql 双模式，并在 MySQL 模式下提供事务边界（积分/订单写入可原子化）。
- 管理端鉴权：`/admin/auth/login` 返回 JWT；生产环境下 `/admin/*` 禁止用 header 冒充身份，必须 `Authorization: Bearer <token>`。
- 员工端鉴权：`/miniapp/auth/login` 返回员工 JWT；miniapp 请求层支持 401 自动重登并重试一次。
- 权限隔离（RBAC）：部门管理员在读接口（员工/订单/申诉/报表）已做部门范围裁剪；写接口（订单处理/申诉审核）已做权限校验。
- 报表导出：支持 `GET /admin/reports/point-records.xlsx`（包含备注等关键字段）。
- Outbox：消息入队、派发、失败重试、processing 超时回收；管理后台提供 outbox 列表、筛选、单条重试与批量重试。
- 分页：管理端主要列表接口支持 `page/pageSize` 返回 `{ data, meta }`（向后兼容不传分页时返回全量数组）。

### 7.2 关键接口速查（后端）

- 管理端登录：`POST /admin/auth/login`
- 员工端登录：`POST /miniapp/auth/login`
- 健康检查：`GET /health`
- 积分报表（分页/筛选）：`GET /admin/reports/point-records?page=&pageSize=&month=&employeeId=`
- 积分报表导出：`GET /admin/reports/point-records.xlsx`
- Outbox 列表：`GET /admin/outbox?page=&pageSize=&status=&type=&employeeId=`
- Outbox 元信息：`GET /admin/outbox/meta`（types + 运维配置）
- Outbox 单条重试：`POST /admin/outbox/{id}/retry`
- Outbox 批量重试 failed：`POST /admin/outbox/retry-failed`（body: `{ type?, employeeId? }`）
- 立即派发 pending：`POST /admin/wecom/dispatch-messages`

### 7.3 管理后台（admin-web）要点

- 登录态：token 过期/401 会自动清理登录态并回到登录页；右上角展示管理员姓名与角色。
- 报表页：支持分页/筛选，并可下载 Excel（下载同样走统一鉴权处理）。
- 日志页：包含 outbox 运维面板（筛选/分页/派发/重试/批量重试，均带二次确认）。

### 7.4 员工端（apps/miniapp，企微自建应用 H5）要点

- 形态：企微自建应用内打开的 H5 网页应用（**不是小程序**）。生产免登=企微 OAuth 网页授权（corpid/agentid 经 `.env.production` 或 storage 配置，跳 `open.weixin.qq.com` 静默授权回跳带 code）；浏览器联调=dev 直登 zhangsan。调试无 UI 面板：切账号 `localStorage.setItem('wecomUserId','xxx')` 后刷新，自定义后端地址 `localStorage.setItem('apiBase','http://...')`。
- 请求内核 `utils/request.ts`：BaseResult 解包、PageResult 归一 Paged、无 token 先登录（冷启动不 401）、401 重登重试一次、GET 离线缓存。
- 11 个页面已全部切新后端契约（PageResult 分页、契约字段名、契约状态映射）；申诉支持四类目标直达（明细/订单/任务领取记录/积分申请）。
- 后端反馈清单：`docs/miniapp-backend-feedback.md`（6 项）；迁移验收看 `docs/miniapp-迁移评审指南.md`。

### 7.5 后续重点（仍建议继续补齐）

生产仍有明显缺口，建议按优先级推进：

- 企业微信真实接入：免登、通讯录同步、消息发送（当前是 mock + outbox 骨架）。
- 安全与运维：JWT_SECRET、数据库密码等密钥管理；日志采集与审计；限流/防刷策略。
- Outbox 生产化：引入真正的 sent/failed 语义、失败原因、DLQ（死信）与可观测指标。
- 数据规模：更完善的筛选条件、索引与 SQL 优化；导出大表的流式导出/异步任务化。
- 部署：Docker Compose/Nginx 配置按生产拓扑调整，补齐环境配置模板与启动校验脚本。

## 8. 操作安全要求

禁止批量删除文件或目录。

不要使用：

- `del /s`
- `rd /s`
- `rmdir /s`
- `Remove-Item -Recirse`
- `Remove-Item -Recurse`

需要删除文件时，只能一次删除一个明确路径的文件，例如：

```powershell
Remove-Item "C:\path\to\file.txt"
```

如果需要批量删除文件，应停止操作，并请求用户手动删除。

## 9. 协作注意事项

- 员工端铁律：**apps/miniapp 是企微自建应用内 H5 应用，与小程序无关**——不要引入 wx.qy.login、小程序 appid、微信开发者工具发布等小程序方案；免登只走企微 OAuth 网页授权。
- 员工端接口一律以 `docs/Easy-Points-API.md` 为准；api 层按功能域组织（同 admin-web），页面直连域函数，类型只进各域 `types.ts`。
- 修改积分相关逻辑时，优先查看后端 `apps/Easy-Points` 对应 service 与契约文档，不要只压表面报错。
- 不要新增能修改或删除积分流水备注的接口。
- 不要绕过 `remark` 必填校验。
- 新增积分变动类型时，应同步考虑员工端展示、报表导出、操作日志和消息通知。
- 数据库层的 `point_records` 不可改删约束是业务底线，不应移除。
- 文档和代码中中文内容应按 UTF-8 保存；PowerShell 读取中文时建议使用 `Get-Content -Encoding UTF8`。
