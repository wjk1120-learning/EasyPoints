# Easy-Points API 文档

## 通用说明

### 基础路径

```
http://<host>:3000
```

> 端口由环境变量 `API_PORT` 配置（默认 3000）；管理端静态资源与 API 同域部署时走 Nginx 代理。

### 统一响应格式

所有 JSON 接口均返回统一的 `BaseResult<T>` 结构：

```json
{
  "code": 1,
  "msg": "成功",
  "data": {}
}
```

| 字段 | 类型    | 说明                         |
| ---- | ------- | ---------------------------- |
| code | Integer | 响应码，1 表示成功，0 表示失败 |
| msg  | String  | 响应信息（失败时为面向管理员的可读文案） |
| data | T       | 返回的数据                   |

下载类接口（`.xlsx`）与静态资源（`/uploads/**`）返回二进制流，不走本结构。

### 认证与权限

身份以本服务签发的 JWT 为准（HS256）：管理端 access 有效期 **12 小时**、员工端 2 小时；另有 refresh 双令牌机制（旋转/撤销/防重放）作为安全超集，前端可仅使用 access。

**HTTP 接口**：除登录/刷新/健康检查外，所有 `/admin/**` 与 `/miniapp/**` 接口均需携带请求头 `Authorization: Bearer <token>`。

未认证（未携带/无效/过期/已撤销）统一返回：

```
HTTP 401
{"code":0,"msg":"未登录","data":null}
```

前端收到 401 → 清除本地令牌 → 回登录页。

**角色权限**（管理端）：`super_admin`（超管）/ `hr_admin`（人事）全局可见；`department_admin`（部门管理员）仅辖内员工可见可操作（读静默裁剪、写越权 403）。内容管理类接口（礼品/任务/规则/投票）`department_admin` 一律 403 `无权操作...`。

无权限时返回：

```
HTTP 403
{"code":0,"msg":"无权限执行该操作","data":null}
```

**令牌双端隔离**：管理端与员工端令牌 aud/typ 双断言，混用一律 401。

### 分页结构

分页接口的 `data` 返回 `PageResult`：

| 字段 | 类型   | 说明         |
| ---- | ------ | ------------ |
| total | long  | 总记录数     |
| rows  | List  | 当前页数据   |

分页参数：`page` 默认 1；`pageSize` 默认 50、上限 200。**员工列表与礼品列表不传 `page/pageSize` 时 `rows` 返回全量**（小表口径）。

审核类列表（订单/申诉/积分申请/任务记录）固定**「待审核」置顶、同状态按创建时间倒序**，跨页排序由后端保证。

### 状态码约定

| HTTP 状态码 | 场景                                 | 典型 msg |
| ----------- | ------------------------------------ | -------- |
| 400         | 参数/业务校验失败、状态机非法流转、冲突（重复审核、礼品重名、同步进行中等） | 见各接口"错误场景" |
| 401         | 未登录/令牌失效                       | `未登录` |
| 403         | 无权限（越部门、department_admin 调内容管理接口） | `无权执行该操作` 等 |
| 404         | 资源不存在 / 未注册路径与方法不匹配    | `接口不存在` / `员工不存在` 等 |
| 413         | 上传文件超过 5MB                      | `文件过大` |
| 502/503     | 企微拉取失败/凭据未配置               | `拉取企微部门失败` 等 |

### 时间与格式约定

| 格式               | 示例                  | 使用场景                       |
| ------------------ | --------------------- | ------------------------------ |
| yyyy-MM-dd HH:mm:ss | 2026-10-10 14:30:00  | 全部时间点字段输出（东八区）   |
| yyyy-MM-dd HH:mm   | 2026-10-12 09:00      | 投票开始/截止（入参与输出）    |
| yyyy-MM-dd         | 2026-10-31            | 任务截止日（入参与输出）、月份查询的日期部分 |
| yyyy-MM            | 2026-10               | 月份查询参数（流水/月度批量）  |

> 时间参数读取兼容 ISO-Z 历史格式（`2026-10-10T06:30:00.000Z`）；月份归组、展示均按东八区口径。

---

## 一、认证与健康模块

### 1.1 管理端登录

**请求**

```
POST /admin/auth/login
Content-Type: application/json
```

**请求体**

| 字段     | 类型   | 必填 | 说明   |
| -------- | ------ | ---- | ------ |
| username | String | 是   | 登录名 |
| password | String | 是   | 密码   |

**响应 `data`：`AdminLoginVo`**

| 字段          | 类型    | 说明                                          |
| ------------- | ------- | --------------------------------------------- |
| token         | String  | 访问令牌（管理端文档契约字段，=accessToken，前端可只用本字段） |
| accessToken   | String  | 访问令牌（12h）                               |
| refreshToken  | String  | 刷新令牌（12h，旋转制）                       |
| tokenType     | String  | 固定 `Bearer`                                 |
| expiresIn     | long    | access 有效期（秒），管理端为 43200           |
| admin         | AdminBrief | 管理员档案                                |

**AdminBrief 结构**

| 字段          | 类型       | 说明                                       |
| ------------- | ---------- | ------------------------------------------ |
| id            | Long       | 管理员 ID                                  |
| username      | String     | 登录名                                     |
| name          | String     | 展示姓名                                   |
| role          | String     | super_admin / hr_admin / department_admin  |
| departmentIds | List\<Long\> | 辖内部门 ID（super/hr 为空列表，不参与裁剪） |

**错误场景**：账号不存在/密码错误/锁定期间均 401 `账号或密码错误`（不泄露存在性；连续失败 5 次锁 10 分钟）。

**响应示例**

```json
{
  "code": 1, "msg": "成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "QVs0YmxzZ2hQ...",
    "tokenType": "Bearer",
    "expiresIn": 43200,
    "admin": { "id": 1, "username": "admin", "name": "系统管理员", "role": "super_admin", "departmentIds": [] }
  }
}
```

---

### 1.2 管理端刷新令牌

**请求**

```
POST /admin/auth/refresh
```

**请求体**：`{"refreshToken": "..."}`

**响应 `data`：`TokenPairVo`**（accessToken / refreshToken / tokenType / expiresIn）。旋转发放新令牌对，旧 refresh 退役；退役串重用触发整族撤销并记安全日志 `auth.token_reuse`。

**错误场景**：失效 401 `刷新令牌无效或已过期`。

---

### 1.3 管理端登出

**请求**

```
POST /admin/auth/logout
```

撤本 family + 当前 access 拉黑（写失败报 500 防"假退出"）→ `data: null`。

---

### 1.4 员工端登录

**请求**

```
POST /miniapp/auth/login
```

**请求体**：生产仅 `{"code":"企微免登code"}`；`{"employeeId":1}` 或 `{"wecomUserId":"..."}` 直登仅 dev profile 开放（非 dev 一律 401 `员工不存在`）。

**响应 `data`：`EmployeeLoginVo`**（accessToken / refreshToken / tokenType / expiresIn=7200 / employee{id,name,wecomUserId,departmentId,status}）。

---

### 1.5 / 1.6 员工端刷新、登出

`POST /miniapp/auth/refresh`、`POST /miniapp/auth/logout`，行为同管理端（刷新失败前端回退企微免登）。

---

### 1.7 健康检查

**请求**

```
GET /health
```

**响应 `data`**：`{ "ok": true, "service": "easy-points-api", "driver": "mysql", "mysqlHost": "localhost", "mysqlPort": 3306, "db": "ok" }`（服务/MySQL 可达性，db 为 "ok"/"error"）。

---

## 二、积分模块（员工端）

### 2.1 我的积分明细（按月分组）

**请求**

```
GET /miniapp/points/records?month={month}&category={category}
```

| 查询参数  | 类型   | 必填 | 默认值 | 说明                                              |
| --------- | ------ | ---- | ------ | ------------------------------------------------- |
| month     | String | 否   | 全部   | 月份（yyyy-MM，按东八区归组）                     |
| category  | String | 否   | 不过滤 | increase / decrease / manual（兼容 pointsDirection） |

**响应 `data`：`Map<String, List<PointRecordItem>>`**，键为月份（降序），行结构见 [PointRecord 结构](#pointrecord-结构)（附归组键 `month`）。

**响应示例**

```json
{
  "code": 1, "msg": "成功",
  "data": {
    "2026-10": [
      { "id": 101, "employeeId": 1, "departmentId": 2, "pointsDelta": 50, "cumulativePointsDelta": 50,
        "type": "performance", "sourceType": "task_reward", "sourceId": "88", "operatorId": 1,
        "operatorName": "系统管理员", "remark": "任务奖励：月度之星评选", "reversalOfId": null,
        "occurredAt": "2026-10-09 15:30:00", "createdAt": "2026-10-09 15:30:01", "month": "2026-10" }
    ]
  }
}
```

---

### 2.2 员工首页聚合

**请求**

```
GET /miniapp/home
```

**响应 `data`：`HomeVo`**

| 字段            | 类型                     | 说明                                   |
| --------------- | ------------------------ | -------------------------------------- |
| employee        | Employee                 | 员工档案（含双积分，见 [Employee 结构](#employee-结构)） |
| pointsBalance   | int                      | 可用积分                               |
| cumulativePoints| int                      | 累计积分                               |
| actualPoints    | int                      | 累计积分（小程序契约别名，=cumulativePoints） |
| monthDelta      | int                      | 本月积分变动（东八区自然月）           |
| unreadMessages  | long                     | 未读消息数                             |
| recentRecords   | List\<PointRecord\>      | 最近 3 条流水                          |

---

### 2.3 积分大厅（分页）

> 注：小程序端积分大厅页已于 2026-10-10 下线，本组接口（2.3/2.4）前端不再消费，后端保留。

仅展示人工加分/扣分、绩效、冲正来源的公开流水。

**请求**

```
GET /miniapp/hall?month={month}&pointsDirection={pointsDirection}&keyword={keyword}&page={page}&pageSize={pageSize}
```

| 查询参数       | 类型   | 必填 | 默认值 | 说明                     |
| -------------- | ------ | ---- | ------ | ------------------------ |
| month          | String | 否   | 不过滤 | 月份（yyyy-MM）          |
| pointsDirection| String | 否   | 不过滤 | increase / decrease      |
| keyword        | String | 否   | 不过滤 | 备注/姓名模糊            |
| page / pageSize| int    | 否   | 1 / 50 | 分页                     |

**响应 `data`：`PageResult`**，`rows` 为 `List<HallItem>`：

| 字段         | 类型    | 说明           |
| ------------ | ------- | -------------- |
| id           | Long    | 流水 ID        |
| employeeId   | Long    | 员工 ID        |
| employeeName | String  | 员工姓名       |
| pointsDelta  | Integer | 积分变动       |
| remark       | String  | 完整备注       |
| operatorName | String  | 操作人         |
| occurredAt   | String  | 发生时间       |
| sourceType   | String  | 业务来源       |
| sourceId     | String  | 来源业务 ID    |

---

### 2.4 大厅增量（角标红点）

**请求**

```
GET /miniapp/hall/unread-count?since={since}
```

| 查询参数 | 类型   | 必填 | 默认值 | 说明                                        |
| -------- | ------ | ---- | ------ | ------------------------------------------- |
| since    | String | 否   | count=0 | 上次游标（latestOccurredAt 原样回传，宽容解析两种时间格式） |

**响应 `data`**：`{ "count": 3, "latestOccurredAt": "2026-10-10 09:12:00" }`

---

### 2.5 积分排行榜

**请求**

```
GET /miniapp/leaderboard?dimension={dimension}
```

| 查询参数  | 类型   | 必填 | 默认值    | 说明                        |
| --------- | ------ | ---- | --------- | --------------------------- |
| dimension | String | 否   | realtime  | realtime=可用积分榜 / cumulative=累计积分榜 |

**响应 `data`：`List<LeaderboardEntry>`**（全量、过滤离职员工，按分数降序）：

| 字段           | 类型    | 说明       |
| -------------- | ------- | ---------- |
| rank           | int     | 名次       |
| id             | Long    | 员工 ID    |
| name           | String  | 姓名       |
| departmentName | String  | 部门名     |
| points         | Integer | 积分       |
| availablePoints| Integer | 可用积分（随行带出，两榜同源） |
| actualPoints   | Integer | 累计积分（小程序契约字段，两榜同源） |
| dimension      | String  | 维度标识   |

---

## 三、积分模块（管理端）

### 3.1 单笔奖惩

**请求**

```
POST /admin/points/adjustment
```

**请求体**

| 字段        | 类型    | 必填 | 说明                                            |
| ----------- | ------- | ---- | ----------------------------------------------- |
| employeeId  | Long    | 是   | 员工 ID（辖内）                                 |
| type        | String  | 否   | reward / penalty（可空，按正负推断）            |
| pointsDelta | Integer | 是   | 积分变动（非零；penalty 输入正数按负计入）      |
| remark      | String  | 是   | 变动原因备注（空 400 `单笔奖惩积分必须填写变动原因备注`） |

**响应 `data`：`PointRecord`**（见 [PointRecord 结构](#pointrecord-结构)），201。加分/人工扣分双积分同动；写操作日志并推送员工通知。

---

### 3.2 月度批量录分

**请求**

```
POST /admin/points/monthly-batch
```

**请求体**

| 字段       | 类型        | 必填 | 说明                                       |
| ---------- | ----------- | ---- | ------------------------------------------ |
| month      | String      | 是   | 月份（yyyy-MM）                            |
| batchRemark| String      | 否   | 统一备注（单人备注为空时必填）             |
| items      | List        | 是   | `[{employeeId, pointsDelta, remark?}]`     |

任一校验失败整体回滚；入账前按员工 ID 排序固定行锁顺序防死锁。响应 `data` 为入账流水数组（行结构同 PointRecord），201。

**错误场景**：月份格式/条目为空 400 `参数格式不合法`；备注双缺 400 `月度批量录分必须填写统一备注或单人备注`。

---

### 3.3 冲正

**请求**

```
POST /admin/points/{recordId}/reverse
```

| 路径参数  | 类型 | 必填 | 说明     |
| --------- | ---- | ---- | -------- |
| recordId  | long | 是   | 原流水 ID |

**请求体**：`{"remark":"录入错误，冲正"}`（必填）。

生成一条反向流水（双维度显式取反，`reversalOfId` 指向原流水；原流水不动）。**积分流水全库无 UPDATE/DELETE 路由，数据库触发器兜底 append-only**，冲正是唯一纠错途径。

**错误场景**：原流水不存在 404 `原积分流水不存在`；重复冲正/冲正再冲正 400 `该积分流水已被冲正，不能重复冲正` / `冲正流水不能再次冲正`。

---

### 3.4 积分流水分页

**请求**

```
GET /admin/reports/point-records?month={month}&employeeId={employeeId}&page={page}&pageSize={pageSize}
```

| 查询参数   | 类型    | 必填 | 默认值 | 说明          |
| ---------- | ------- | ---- | ------ | ------------- |
| month      | String  | 否   | 不过滤 | 月份（yyyy-MM） |
| employeeId | Long    | 否   | 不过滤 | 员工 ID       |
| page / pageSize | int | 否 | 1 / 50 | 分页          |

**响应 `data`：`PageResult`**，`rows` 为 `List<PointReport>`（PointRecord + `employeeName`）。

---

### 3.5 个人积分明细导出

**请求**

```
GET /admin/reports/point-records.xlsx?employeeId={employeeId}&month={month}
```

| 查询参数   | 类型   | 必填 | 说明          |
| ---------- | ------ | ---- | ------------- |
| employeeId | Long   | 是   | 员工 ID       |
| month      | String | 是   | 月份（yyyy-MM） |

返回 xlsx 二进制流（文件名由前端拼接）。列：员工、部门、**可用积分变动、累计积分变动**、类型、操作人、时间（yyyy-MM-dd HH:mm:ss）、备注（完整）、来源类型、来源ID、冲正原流水ID。

> 列口径（2026-10-10 前端反馈③定稿）：术语统一「可用积分/累计积分」；部门/来源类型/来源ID/冲正原流水ID 为**保留的扩展列**（管理员排查追溯用），定稿即此口径，不加不减。

---

## 四、商城与订单模块

### 4.1 礼品列表（管理端，全量含下架）

**请求**

```
GET /admin/mall/gifts
```

**响应 `data`：`List<Gift>`（裸数组，小表不设分页）**。**仅内容管理员**（department_admin 403，下同）。

**Gift 结构**

| 字段          | 类型    | 说明                                |
| ------------- | ------- | ----------------------------------- |
| id            | Long    | 礼品 ID                             |
| name          | String  | 名称（全库唯一，范围含已下架）      |
| pointsCost    | Integer | 兑换所需可用积分                    |
| stock         | Integer | 当前库存                            |
| status        | String  | active=上架 / inactive=下架         |
| limitPerUser  | Integer | 单人限兑数量（null=不限）           |
| coverImageUrl| String  | 封面相对路径（/uploads/gifts/...）  |
| createdAt / updatedAt | String | 创建/更新时间             |

**响应示例**

```json
{
  "code": 1, "msg": "成功",
  "data": { "total": 2, "rows": [
    { "id": 1, "name": "京东购物卡 100 元", "pointsCost": 1000, "stock": 20, "status": "active",
      "limitPerUser": 2, "coverImageUrl": "/uploads/gifts/1/cover-a1b2.png",
      "createdAt": "2026-09-01 09:00:00", "updatedAt": "2026-10-08 18:00:00" } ] }
}
```

---

### 4.2 新增礼品 ／ 4.3 编辑礼品

**请求**

```
POST /admin/mall/gifts          （201）
PUT  /admin/mall/gifts/{id}
```

**请求体（GiftPayload）**

| 字段         | 类型    | 必填 | 说明                                        |
| ------------ | ------- | ---- | ------------------------------------------- |
| name         | String  | 是   | 名称（唯一，范围含已下架；编辑排除自身）    |
| pointsCost   | Integer | 是   | 兑换积分（>0）                              |
| stock        | Integer | 新建可空 | 库存（新建默认 0；**编辑不覆盖库存**，库存走 4.4） |
| limitPerUser | Integer | 否   | 单人限兑（null=不限，>0）                   |
| status       | String  | 否   | active / inactive                           |

**响应 `data`：`Gift`**。

**错误场景**：参数非法 400 `礼品参数不合法`；重名 400 `礼品名称已存在（含已下架礼品）`；编辑不存在 404 `礼品不存在`。

---

### 4.4 调整库存

**请求**

```
POST /admin/mall/gifts/{id}/stock
```

**请求体**：`{"delta": 5}`（相对增减，正=补货、负=减库存；非零；调整后为负 400 `调整后库存不能为负`）。响应 `data` 为更新后 Gift。

---

### 4.5 上架 / 下架

**请求**

```
POST /admin/mall/gifts/{id}/publish
POST /admin/mall/gifts/{id}/unpublish
```

下架礼品用户端隐藏、历史订单保留。响应 `data`：`Gift`。

---

### 4.6 上传封面

**请求**

```
POST /admin/mall/gifts/{id}/cover
Content-Type: multipart/form-data
```

| 表单字段 | 类型 | 必填 | 说明                        |
| -------- | ---- | ---- | --------------------------- |
| file     | File | 是   | 图片，≤5MB（超限 413）      |

响应 `data`：含 `coverImageUrl`（相对路径，前端拼静态前缀）的 Gift。

---

### 4.7 上架礼品列表（员工端）

**请求**

```
GET /miniapp/mall/gifts
```

**响应 `data`**：仅 `status=active` 礼品，行结构同 Gift（库存 0 由前端置灰）。

---

### 4.8 兑换下单（员工端）

**请求**

```
POST /miniapp/orders
```

**请求体**：`{"giftId": 1}` → 201。

下单校验：礼品上架/库存/可用积分余额/单人限兑（排除已驳回订单计数）；幂等锁防双击；仅扣**可用积分**（累计积分不动）。扣分流水 type=`exchange`。

**响应 `data`：`Order`**（见 [Order 结构](#order-结构)，status=`pending_review`）。

**错误场景**：礼品不存在/下架 404 `礼品不存在或已下架`；库存不足 400 `库存不足`；余额不足 400 `积分余额不足`；超限兑 400 `超出单人限兑数量`；重复提交 400 `操作过于频繁，请勿重复提交`。

---

### 4.9 我的订单（员工端）

**请求**

```
GET /miniapp/orders?status={status}
```

**响应 `data`**：`List<Order>`（创建倒序；status 可选单值）。

---

### 4.10 订单列表（管理端，待审置顶）

**请求**

```
GET /admin/orders?status={status}&employeeId={employeeId}&createdAfter={createdAfter}&createdBefore={createdBefore}&page={page}&pageSize={pageSize}
```

| 查询参数             | 类型   | 必填 | 默认值 | 说明                                   |
| -------------------- | ------ | ---- | ------ | -------------------------------------- |
| status               | String | 否   | 不过滤 | pending_review / approved / rejected   |
| employeeId           | Long   | 否   | 不过滤 | 员工 ID                                |
| createdAfter/Before  | String | 否   | 开区间 | 创建时间范围                           |
| page / pageSize      | int    | 否   | 1 / 50 | 分页                                   |

**响应 `data`：`PageResult`**，`rows` 为 `List<Order>`（含 `employeeName`，join 带出；**待审核置顶、同状态创建倒序**）。

**Order 结构**

| 字段        | 类型    | 说明                                              |
| ----------- | ------- | ------------------------------------------------- |
| id          | Long    | 订单 ID（即订单号）                               |
| employeeId  | Long    | 员工 ID                                           |
| employeeName| String  | 员工姓名（列表行 join 带出）                      |
| giftId      | Long    | 礼品 ID                                           |
| giftName    | String  | 礼品名快照                                        |
| pointsCost  | Integer | 成交积分快照                                      |
| status      | String  | pending_review / approved（闭环终点）/ rejected   |
| remark      | String  | 审核备注（驳回必填；存储列 review_remark，输出名 remark） |
| createdAt / updatedAt | String | 下单/流转时间                          |

---

### 4.11 订单审核

**请求**

```
POST /admin/orders/{id}/status
```

**请求体**

| 字段   | 类型   | 必填 | 说明                                  |
| ------ | ------ | ---- | ------------------------------------- |
| status | String | 是   | approved / rejected（三态状态机）     |
| remark | String | 驳回必填 | 处理备注（空 400 `处理备注不能为空`） |

审核通过即闭环终点；**驳回同事务自动退分**（type=`refund`，只回可用积分）+ 回补库存 + 日志 + 员工通知。

**错误场景**：非法流转（重复审核等）400 `订单状态不能从 X 变更为 Y`；订单不存在 404 `订单不存在`。

---

## 五、任务模块

### 5.1 任务大厅（员工端，分页）

**请求**

```
GET /miniapp/tasks?scope={scope}&page={page}&pageSize={pageSize}
```

| 查询参数   | 类型   | 必填 | 默认值 | 说明                                            |
| ---------- | ------ | ---- | ------ | ----------------------------------------------- |
| scope      | String | 否   | all    | all=全部可领取任务（含个人状态）/ mine=我领取提交过的 |
| page / pageSize | int | 否  | 1 / 50 | 分页                                            |

**响应 `data`：`PageResult`**，`rows` 为 `List<Task>`。**status 为个人视角状态**（v4.2 小程序契约）：
`open`（可领取，未领取）/ `in_progress` / `pending_review` / `approved` / `rejected`（本人领取记录状态），
另附 `statusText` 中文与 `title`（=name）；scope=all 时仅 published 且在有效期内，**截止临近在前、长期有效排最后**。

**Task 结构**

| 字段         | 类型    | 说明                                          |
| ------------ | ------- | --------------------------------------------- |
| id           | Long    | 任务 ID                                       |
| name / title | String  | 任务名称（title 为小程序契约别名，同值）      |
| description  | String  | 任务描述                                      |
| rewardPoints | Integer | 奖励积分（>0，审核通过双积分同加）            |
| requirement  | String  | 完成要求                                      |
| deadline     | String  | 截止日（yyyy-MM-dd，由 validUntil 推导；null=长期有效） |
| validFrom / validUntil | String | 有效期起/止（兼容输出，东八区时间） |
| status       | String  | 个人视角状态（open/记录状态；见上）           |
| statusText   | String  | 状态中文（可领取/进行中/待审核/已通过/已驳回）|
| claimedByMe  | boolean | 本人是否已领取（已领取/已提交/已审恒 true）   |
| createdBy    | Long    | 创建管理员                                    |
| createdAt / updatedAt | String | 创建/更新时间                      |

---

### 5.2 领取任务（员工端）

**请求**

```
POST /miniapp/tasks/{id}/claim
```

→ 201，`data` 为更新后的**任务行**（status=`in_progress`，见 [Task 结构](#task-结构)）。一人一任务仅可领取一次（唯一键兜底）。

**错误场景**：任务不存在/已下架/不在有效期 404 `任务不存在或已下架`；重复领取 400 `已领取过该任务`。

---

### 5.2b 按任务 ID 提交成果（员工端，小程序契约路由）

**请求**

```
POST /miniapp/tasks/{id}/submit
```

**请求体**

| 字段           | 类型         | 必填 | 说明                                 |
| -------------- | ------------ | ---- | ------------------------------------ |
| content        | String       | 是   | 成果说明（空 400 `成果说明不能为空`；兼容 text 字段） |
| evidenceImages | List\<String\> | 否 | 佐证图 URL（≤9 张）                  |

按任务 ID 定位本人领取记录（未领取 400 `请先领取该任务再提交成果`）→ 提交后 status 置 `pending_review` 并回填 `submittedAt`；**截止日后不可提交**。→ 201，`data` 为任务行（status=pending_review）。**本接口不动积分**（审核通过由管理端入账）。

---

### 5.3 我的任务（员工端，分页）

**请求**

```
GET /miniapp/task-claims?status={status}&page={page}&pageSize={pageSize}
```

**响应 `data`：`PageResult`**，`rows` 为 `List<TaskRecord>`（含任务快照与已下架/删除任务历史）。

---

### 5.4 提交成果（员工端）

**请求**

```
POST /miniapp/task-claims/{id}/submit
```

**请求体**

| 字段           | 类型         | 必填 | 说明                            |
| -------------- | ------------ | ---- | ------------------------------- |
| text           | String       | 否   | 成果说明                        |
| evidenceImages | List\<String\> | 否 | 佐证图 URL（≤9 张）             |

提交后 status 置 `pending_review` 并回填 `submittedAt`。**截止日后不可提交**。

**错误场景**：状态不可提交 400 `当前状态不可提交`；过期 400 `任务已过截止时间，不可提交成果`。

---

### 5.5 任务列表（管理端，分页）

**请求**

```
GET /admin/tasks?status={status}&page={page}&pageSize={pageSize}
```

status 取 published / unpublished（显式传 deleted 可查已删除；缺省过滤 deleted）。**内容管理员**（department_admin 403，下同）。`data`：`PageResult<Task>`，创建倒序。

---

### 5.6 新建任务 ／ 5.7 编辑任务

**请求**

```
POST /admin/tasks              （201）
PUT  /admin/tasks/{id}
```

**请求体（TaskPayload）**

| 字段         | 类型    | 必填 | 说明                                                     |
| ------------ | ------- | ---- | -------------------------------------------------------- |
| name         | String  | 是   | 任务名称                                                 |
| description  | String  | 否   | 任务描述                                                 |
| rewardPoints | Integer | 是   | 奖励积分（>0）                                           |
| requirement  | String  | 否   | 完成要求                                                 |
| deadline     | String  | 否   | 截止日（yyyy-MM-dd；映射 validUntil=当日 23:59:59 东八区） |
| validFrom / validUntil | String（时间） | 否 | 兼容入参（deadline 非空时以 deadline 为准） |
| status       | String  | 否   | **新建默认 unpublished（文档契约：默认已下架）**          |

**响应 `data`：`Task`**。**错误场景**：参数非法 400 `参数格式不合法`；任务不存在 404 `任务不存在`。

---

### 5.8 上架 / 下架 ／ 5.9 删除任务

**请求**

```
POST /admin/tasks/{id}/publish
POST /admin/tasks/{id}/unpublish
POST /admin/tasks/{id}/delete      （文档契约路由；DELETE /admin/tasks/{id} 等价保留）
```

删除为软删除（status=deleted），**员工领取记录历史保留**，需前端二次确认。均响应 `data: Task`。

---

### 5.10 任务记录列表（管理端，待审置顶）

**请求**

```
GET /admin/task-records?status={status}&employeeId={employeeId}&taskId={taskId}&createdAfter={createdAfter}&createdBefore={createdBefore}&page={page}&pageSize={pageSize}
```

| 查询参数             | 类型   | 必填 | 默认值 | 说明                                            |
| -------------------- | ------ | ---- | ------ | ----------------------------------------------- |
| status               | String | 否   | 不过滤 | in_progress / pending_review / approved / rejected |
| employeeId           | Long   | 否   | 不过滤 | 员工 ID                                         |
| taskId               | Long   | 否   | 不过滤 | 任务 ID                                         |
| createdAfter/Before  | String | 否   | 开区间 | 领取时间范围                                    |
| page / pageSize      | int    | 否   | 1 / 50 | 分页                                            |

**响应 `data`：`PageResult`**，`rows` 为 `List<TaskRecord>`（**待审核置顶**、同状态领取时间倒序；部门管理员辖内裁剪）。

**TaskRecord 结构**

| 字段             | 类型         | 说明                                            |
| ---------------- | ------------ | ----------------------------------------------- |
| id               | Long         | 记录 ID（积分流水 source_id 引用）              |
| taskId / taskName| Long / String | 任务 ID / 名称快照（join tasks 带出）          |
| rewardPoints     | Integer      | 奖励积分快照                                    |
| employeeId / employeeName | Long / String | 领取员工             |
| status           | String       | in_progress / pending_review / approved / rejected |
| submissionText   | String       | 成果说明（存储列 submitted_text，输出名 submissionText） |
| submissionImages | List\<String\> | 佐证图 URL 数组（存储 JSON 字符串，输出数组化） |
| submittedAt      | String       | 提交时间（提交时回填；未提交为 null）           |
| reviewRemark     | String       | 审核备注（驳回必填）                            |
| reviewerId       | Long         | 审核管理员                                      |
| reviewedAt       | String       | 审核时间                                        |
| createdAt / updatedAt | String   | 领取/更新时间                                   |

---

### 5.11 成果审核

**请求**

```
POST /admin/task-records/{id}/review
```

**请求体**

| 字段   | 类型   | 必填 | 说明                              |
| ------ | ------ | ---- | --------------------------------- |
| status | String | 是   | approved / rejected               |
| remark | String | 驳回必填 | 处理备注（空 400 `处理备注不能为空`） |

仅 `pending_review` 可审；通过 → type=`performance` 流水双积分入账 + 日志 + 通知；驳回后员工可申诉。

**错误场景**：非待审 400 `该任务当前状态不可审核`；记录不存在 404 `任务领取记录不存在`。

---

## 六、积分申请模块

### 6.1 提交申请（员工端）

**请求**

```
POST /miniapp/point-applications
```

**请求体**

| 字段           | 类型         | 必填 | 说明                             |
| -------------- | ------------ | ---- | -------------------------------- |
| points         | Integer      | 是   | 申请分值（正数）                 |
| description    | String       | 是   | 贡献描述（**输出字段名为 reason**） |
| evidenceImages | List\<String\> | 否 | 佐证图 URL（≤9 张）              |

→ 201，幂等锁防双击。**错误场景**：分值非正 400 `申请分值必须为正数`；描述空 400 `贡献描述不能为空`。

---

### 6.2 我的申请（员工端，分页）

**请求**

```
GET /miniapp/point-applications?status={status}&page={page}&pageSize={pageSize}
```

---

### 6.3 申请列表（管理端，待审置顶）

**请求**

```
GET /admin/applications?status={status}&employeeId={employeeId}&createdAfter={createdAfter}&page={page}&pageSize={pageSize}
```

| 查询参数        | 类型   | 必填 | 默认值 | 说明                                      |
| --------------- | ------ | ---- | ------ | ----------------------------------------- |
| status          | String | 否   | 不过滤 | pending_review / approved / rejected      |
| employeeId      | Long   | 否   | 不过滤 | 员工 ID                                   |
| createdAfter    | String | 否   | 开区间 | 提交时间下界                             |
| page / pageSize | int    | 否   | 1 / 50 | 分页                                      |

**响应 `data`：`PageResult`**，`rows` 为 `List<Application>`（**待审核置顶**；辖内裁剪）。

**Application 结构**

| 字段           | 类型         | 说明                                                   |
| -------------- | ------------ | ------------------------------------------------------ |
| id             | Long         | 申请 ID                                                |
| employeeId / employeeName | Long / String | 申请员工                                    |
| points         | Integer      | 申请分值                                               |
| reason         | String       | 贡献描述（存储列 description，输出名 reason）          |
| evidenceImages | List\<String\> | 佐证图 URL 数组（存储 JSON 字符串，输出数组化）     |
| status         | String       | pending_review / approved / rejected                   |
| statusText     | String       | 状态中文（待审核/已通过/已驳回，计算字段）             |
| reviewRemark   | String       | 审核备注（驳回必填）                                   |
| reviewerId     | Long         | 审核管理员 ID                                          |
| reviewedBy     | String       | 审核人姓名（join admins 带出，未审核为 null）          |
| reviewedAt     | String       | 审核时间                                               |
| createdAt / updatedAt | String | 提交/更新时间                                        |

**响应示例**

```json
{
  "code": 1, "msg": "成功",
  "data": { "total": 1, "rows": [
    { "id": 31, "employeeId": 1, "employeeName": "张三", "points": 50, "reason": "完成跨部门支持",
      "evidenceImages": ["/uploads/ev/2.png"], "status": "pending_review", "reviewRemark": null,
      "reviewerId": null, "reviewedBy": null, "reviewedAt": null,
      "createdAt": "2026-10-10 09:00:00", "updatedAt": "2026-10-10 09:00:00" } ] }
}
```

---

### 6.4 申请审核

**请求**

```
POST /admin/applications/{id}/review
```

**请求体**

| 字段   | 类型   | 必填 | 说明                                  |
| ------ | ------ | ---- | ------------------------------------- |
| status | String | 是   | approved / rejected                   |
| remark | String | 驳回必填 | 处理备注（空 400 `处理备注不能为空`） |

通过 → type=`application` 流水双积分入账 + 日志 + 通知；驳回后员工可申诉。

**错误场景**：非待审 400 `该申请当前状态不可审核`；申请不存在 404 `申请不存在`。

---

## 七、申诉模块（一级审核）

### 7.1 提交申诉（员工端）

**请求**

```
POST /miniapp/appeals
```

**请求体**

| 字段           | 类型         | 必填 | 说明                                                       |
| -------------- | ------------ | ---- | ---------------------------------------------------------- |
| targetType     | String       | 是   | point_record / task_claim / order / point_application      |
| targetId       | Long         | 是   | 目标记录 ID（须为本人记录；扣分流水/被驳回记录可申诉）     |
| reason         | String       | 是   | 申诉理由（空 400 `申诉原因不能为空`）                      |
| evidenceImages | List\<String\> | 否 | 佐证图 URL（≤9 张）                                        |

→ 201。同一目标仅可申诉一次（唯一键 `(target_type, target_id)` 兜底）。**错误场景**：非本人/不存在 400 `只能申诉本人存在的积分流水` 等；重复申诉 400 `该记录已申诉过，不能重复申诉`；目标状态不支持 400 `该记录当前状态不支持申诉`。

---

### 7.2 我的申诉（员工端，分页）

**请求**

```
GET /miniapp/appeals?status={status}&page={page}&pageSize={pageSize}
```

---

### 7.3 申诉列表（管理端，待审置顶）

**请求**

```
GET /admin/appeals?status={status}&employeeId={employeeId}&createdAfter={createdAfter}&page={page}&pageSize={pageSize}
```

**响应 `data`：`PageResult`**，`rows` 为 `List<Appeal>`（**待审核置顶**；辖内裁剪）。

**Appeal 结构**

| 字段          | 类型    | 说明                                                     |
| ------------- | ------- | -------------------------------------------------------- |
| id            | Long    | 申诉 ID                                                  |
| targetType / targetId | String / Long | 申诉目标（四类）                        |
| pointRecordId | Long    | 关联原流水 ID（仅 targetType=point_record 时=targetId，其余 null） |
| pointRecord   | PointRecord | 关联原流水完整对象（含备注；仅 point_record 目标附带） |
| employeeId / employeeName | Long / String | 申诉员工                              |
| reason        | String  | 申诉理由                                                 |
| evidenceImages| String  | 佐证图 URL 数组（JSON 字符串存储且原样输出）             |
| targetSummary | TargetSummary | 被申诉原记录摘要（审核上下文，四类目标统一结构，见下） |
| status        | String  | pending_review / approved / rejected                     |
| statusText    | String  | 状态中文（待审核/审核通过/已驳回，计算字段）             |
| resolution    | String  | 处理意见（小程序契约别名，=resultRemark）                |
| reviewerId    | Long    | 审核管理员                                               |
| resultRemark  | String  | 处理备注（审核必填，员工可见）                           |
| createdAt / updatedAt | String | 提交/处理时间                                  |

**TargetSummary 结构**（被申诉原记录摘要，审核申诉的上下文）

| 字段         | 类型   | 说明                                                        |
| ------------ | ------ | ----------------------------------------------------------- |
| title        | String | 标题：任务名 / 申请缘由 / 礼品名 / `积分流水 #ID`           |
| content      | String | 内容说明：提交成果 / `申请分值 X 分` / `兑换积分 X 分` / 流水备注 |
| reviewRemark | String | 当时审核备注（驳回理由；扣分流水无此字段为 null）           |

---

### 7.4 申诉审核（一级）

**请求**

```
POST /admin/appeals/{id}/review
```

**请求体**

| 字段        | 类型   | 必填 | 说明                              |
| ----------- | ------ | ---- | --------------------------------- |
| status      | String | 是   | approved / rejected               |
| resultRemark| String | 是   | 处理备注（空 400 `处理备注不能为空`） |

一级审核（无 stage 参数）；部门管理员仅辖内、hr/super 全局。**审核通过且目标为未冲正的扣分流水 → 同事务自动生成补分流水**（sourceType=`appeal_compensation`，type=reward 双积分同加）+ 日志 + 通知；驳回 → 员工可见处理备注。

**错误场景**：已处理再审 400 `该申诉已处理完毕`；申诉不存在 404 `申诉不存在`。

---

## 八、规则中心模块

### 8.1 获取当前生效规则（单对象契约）

**请求**

```
GET /admin/rules
```

**响应 `data`：`RuleContent`**（当前生效 = 最新 published；无规则时 content 为空串）

| 字段      | 类型   | 说明                       |
| --------- | ------ | -------------------------- |
| content   | String | 规则富文本 HTML（wangeditor） |
| updatedAt | String | 最近更新时间               |
| updatedBy | String | 最近更新人姓名             |

---

### 8.2 保存规则（单对象契约）

**请求**

```
PUT /admin/rules
```

**请求体**

| 字段    | 类型   | 必填 | 说明                                     |
| ------- | ------ | ---- | ---------------------------------------- |
| content | String | 是   | 富文本 HTML（100KB 上限；空 400 `规则内容不能为空`） |

upsert 当前生效单行（内容变更 version+1），**保存后即时生效，小程序无需发版**；写日志 `rule.updated`。响应 `data` 同 8.1。

---

### 8.3 ~ 8.6 多规则 CRUD（保留）

```
GET /admin/point-rules                       全部规则（含 draft）
POST /admin/point-rules                      新建（201）
PUT  /admin/point-rules/{id}                 编辑（内容/标题变更 version+1）
POST /admin/point-rules/{id}/publish         发布（仅置 published，不递增版本）
```

**请求体（RuleSaveDto）**：`{title(必填), content(必填), status?(draft/published)}`；行结构 `{id,title,content,version,status,updatedBy,createdAt,updatedAt}`。

---

### 8.7 已发布规则（员工端）

**请求**

```
GET /miniapp/rules
```

**响应 `data`：`List<{id,title,content,version,updatedAt}>`**（仅 published，与 /admin/rules 同数据源）。

---

## 九、投票评审模块（不触碰积分台账）

> **硬约束**：投票仅作积分审核参考，不自动加积分、不自动完成审核。

### 9.1 投票列表（管理端，分页）

**请求**

```
GET /admin/votes?title={title}&status={status}&page={page}&pageSize={pageSize}
```

| 查询参数   | 类型   | 必填 | 默认值 | 说明                                                |
| ---------- | ------ | ---- | ------ | --------------------------------------------------- |
| title      | String | 否   | 不过滤 | 标题模糊（兼容 keyword 参数）                       |
| status     | String | 否   | 不过滤 | not_started / in_progress / ended（派生状态，兼容内部值） |
| page / pageSize | int | 否  | 1 / 50 | 分页                                                |

**响应 `data`：`PageResult`**，`rows` 为 `List<Vote>`（创建倒序；**内容管理员**）。

**Vote 结构**

| 字段              | 类型    | 说明                                                  |
| ----------------- | ------- | ----------------------------------------------------- |
| id                | Long    | 投票 ID                                               |
| title / description | String | 标题 / 描述                                          |
| voteType          | String  | single=单选 / multiple=多选                           |
| relatedType       | String  | 关联业务：""=普通调研 / task=任务记录 / application=积分申请 |
| relatedId         | Long    | 关联业务 ID（可空）                                   |
| relatedLabel      | String  | 关联业务标签（当前恒 null，预留）                     |
| startTime / endTime | String | 开始/截止（yyyy-MM-dd HH:mm，东八区）               |
| closed            | boolean | 是否已手动关闭（到期结束不置位，由 status 表达）      |
| status            | String  | not_started / in_progress / ended（服务端派生回填）   |
| options           | List    | `[{id, text}]` 选项（批量查询回填）                   |
| participantIds    | List\<Long\> | 参与人 ID 列表（编辑投票回填选人框用，批量查询回填） |
| participantCount  | long    | 应参与人数                                            |
| participantNames  | List\<String\> | 参与人姓名列表（批量查询回填）                 |
| submittedCount    | long    | 已提交人数                                            |
| relatedLabel      | String  | 关联业务标签（服务端回填友好文本，如 `任务 #7 · 整理客户回访文档`；普通调研为 null） |
| createdBy         | Long    | 创建管理员                                            |
| createdAt / updatedAt | String | 创建/更新时间                                     |
| submittedByMe     | boolean | 员工端行：本人是否已提交（管理端恒 false）            |

**响应示例**

```json
{
  "code": 1, "msg": "成功",
  "data": { "total": 1, "rows": [
    { "id": 11, "title": "月度之星评选", "description": "本月之星投票", "voteType": "single",
      "relatedType": "", "relatedId": null, "relatedLabel": null,
      "startTime": "2026-10-08 09:00", "endTime": "2026-10-12 18:00", "closed": false,
      "participantCount": 5, "participantIds": [1, 2, 3, 4, 5], "submittedCount": 3, "status": "in_progress",
      "options": [ { "id": 101, "text": "张三" }, { "id": 102, "text": "李四" } ],
      "participantNames": ["张三", "李四", "王五", "赵六", "钱七"],
      "createdBy": 1, "createdAt": "2026-10-07 10:00:00", "submittedByMe": false } ] }
}
```

---

### 9.2 创建投票

**请求**

```
POST /admin/votes
```

**请求体（VotePayload）**

| 字段           | 类型         | 必填 | 说明                                                     |
| -------------- | ------------ | ---- | -------------------------------------------------------- |
| title          | String       | 是   | 标题（空 400 `投票标题不能为空`）                        |
| options        | List         | 是   | 选项（≥2 条 400 `投票至少需要2个选项`；**纯字符串数组**，选项 ID 服务端生成；兼容 [{content,sort?}] 对象） |
| startTime      | String       | 是   | 开始时间（yyyy-MM-dd HH:mm；兼容 startAt）               |
| endTime        | String       | 是   | 截止时间（开始<截止 400 `开始时间不能晚于截止时间`）      |
| participantIds | List\<Long\> | 是   | 参与人员工 ID（≥1 人 400 `请至少勾选1位参与人员`）       |
| voteType       | String       | 是   | single / multiple（创建后不可改）                        |
| relatedType / relatedId | String / Long | 否 | 关联业务（""/task/application；兼容 bizType）    |

→ 201，`data` 为 Vote 行。到开始时间自动向参与员工推送邀请通知；未勾选员工不可见。

---

### 9.3 编辑投票

**请求**

```
POST /admin/votes/{id}/update      （文档契约路由；PUT /admin/votes/{id} 等价保留）
```

**仅未开始可编辑**（已开始 400 `投票已开始，不可编辑`）；请求体同创建（voteType 不可改）；选项整体重建（全库唯一物理 DELETE 场景，仅此零提交时发生）。

---

### 9.4 手动关闭

**请求**

```
POST /admin/votes/{id}/close
```

关闭后不可提交，视为已结束。**错误场景**：已结束 400 `投票已结束，无需关闭`。

---

### 9.5 投票统计

**请求**

```
GET /admin/votes/{id}/stats       （GET /admin/votes/{id}/statistics 等价保留）
```

进行中/已结束可查（未开始 400 `投票未开始`）。

**响应 `data`：`VoteStats`**

| 字段              | 类型   | 说明                                |
| ----------------- | ------ | ----------------------------------- |
| totalParticipants | long   | 应参与人数                          |
| submittedCount    | long   | 实际提交人数                        |
| participationRate | long   | 参与率（0-100 整数）                |
| optionStats       | List   | `[{optionId, text, votes, percent}]`（percent 两位小数，含零票选项） |
| details           | List   | `[{employeeId, employeeName, selectedTexts[], submittedAt}]`（所选选项为文本） |

**响应示例**

```json
{
  "code": 1, "msg": "成功",
  "data": {
    "totalParticipants": 5, "submittedCount": 3, "participationRate": 60,
    "optionStats": [ { "optionId": 101, "text": "张三", "votes": 2, "percent": 66.67 },
                     { "optionId": 102, "text": "李四", "votes": 1, "percent": 33.33 } ],
    "details": [ { "employeeId": 1, "employeeName": "张三", "selectedTexts": ["张三"], "submittedAt": "2026-10-10 09:30:00" } ] }
}
```

---

### 9.6 投票统计导出

**请求**

```
GET /admin/votes/{id}/stats.xlsx
```

两 sheet 定稿（列不加不减）：

| Sheet | 列 |
| ----- | -- |
| 投票统计 | 投票主题、选项、票数（一行一选项）+ 尾部**合计行** + **最高票选项行**（并列时顿号连接全部列出） |
| 参与明细 | 投票人、所选选项（文本）、提交时间 |

---

### 9.7 我的投票（员工端，分页）

**请求**

```
GET /miniapp/votes?scope={scope}&page={page}&pageSize={pageSize}
```

scope：pending（待参与）/ history（已提交或已结束），以参与人表为读裁剪依据。列表行在管理端 Vote 字段基础上附小程序契约字段：

| 字段      | 类型    | 说明                                              |
| --------- | ------- | ------------------------------------------------- |
| mode      | String  | 投票模式（=voteType：single/multiple）            |
| submitted | boolean | 本人是否已提交（=submittedByMe）                  |
| deadline  | String  | 截止时间（yyyy-MM-dd HH:mm）                      |
| expired   | boolean | 是否已截止（手动关闭或到期；服务端回填）          |
| relatedLabel | String | 关联业务标签（如 `任务 #7 · 整理客户回访文档`；普通调研为 null） |

---

### 9.8 投票详情（员工端）

**请求**

```
GET /miniapp/votes/{id}
```

非参与者 404 `投票不存在`。**响应 `data`**（员工端口径）：`{id,title,description,bizType,bizId,voteType,mode,startAt,endAt,closedAt,status(pending/active/closed),statusText,submittedByMe,submitted,myOptionIds,mySubmittedAt,selectedOptionIds,options:[{id,text,sort}]}`（`mode`/`submitted` 为别名，`options[].text`/`selectedOptionIds` 为小程序契约字段名）。

---

### 9.9 提交投票（员工端）

**请求**

```
POST /miniapp/votes/{id}/ballots      （小程序契约路由；POST /miniapp/votes/{id}/submit 等价保留）
```

**请求体**：`{"optionIds":[101]}`（单选恰 1 项；选项须属于该投票）→ 201：ballots 路由返回提交后**投票详情**（含 `selectedOptionIds` 回显）；submit 旧路由返回 `{"submittedAt":"..."}`。每人限投 1 次、提交后不可改（唯一键兜底）；幂等锁防双击。

**错误场景**：未开始/已结束 400 `投票未开始` / `投票已结束，无法提交`；未选 400 `请选择投票选项`；选项无效 400 `投票选项无效`；单选多选 400 `该投票为单选，仅能选择1个选项`；重复提交 400 `已提交过投票，不能重复提交`。

---

## 十、通知中心、outbox 与企微模块

### 10.1 我的消息（员工端，分页）

**请求**

```
GET /miniapp/messages?unreadOnly={unreadOnly}&page={page}&pageSize={pageSize}
```

**响应 `data`：`PageResult`**，`rows` 为 `List<Message>`（含发送失败记录）：

| 字段       | 类型    | 说明                       |
| ---------- | ------- | -------------------------- |
| id         | Long    | 消息 ID                    |
| type       | String  | 消息类型（见附录）         |
| status     | String  | pending/processing/mock_sent/failed |
| statusText | String  | 待发送/发送中/已发送/发送失败 |
| isRead     | boolean | 是否已读                   |
| readAt     | String  | 已读时间                   |
| title / summary | String | 标题/摘要（富化后文案）|
| voteId        | Long    | 深链投票 ID（payload 含 voteId 时带出，如 vote_invitation，点击直达详情；其余 null） |
| createdAt / updatedAt | String | 时间          |

### 10.2 / 10.3 标记已读

```
POST /miniapp/messages/{id}/read
POST /miniapp/messages/read-all
```

### 10.4 / 10.5 outbox 运维面板（管理端）

```
GET /admin/outbox?status={status}&type={type}&employeeId={employeeId}&page=...   ✔ 分页
GET /admin/outbox/meta
```

meta：`{"types":[{type,count}...],"config":{processingTimeoutSec,maxRetries,batchSize}}`。

### 10.6 / 10.7 人工重试

```
POST /admin/outbox/{id}/retry          单条（辖内）→ 更新后的消息对象
POST /admin/outbox/retry-failed        批量 → {"count":N}
```

---

### 10.8 通讯录一键拉取同步

**请求**

```
POST /admin/wecom/sync-contacts
```

无请求体。后端主动拉企微通讯录（部门树→成员详情）→ 部门/员工 upsert → **离职/移出可见范围自动置 inactive**（历史流水保留；回归名单自动重新激活）→ 计数报告。Redis 互斥锁防重入；写日志 `wecom.contacts_synced`。

**响应 `data`：`{ "created": 2, "updated": 13, "disabled": 1, "total": 15 }`**（total=企微名单总人数）

**错误场景**：同步进行中 400 `同步进行中，请稍候`；凭据未配置 503 `企微凭据未配置，无法拉取通讯录`；拉取失败 502 `获取企微 access_token 失败` / `拉取企微部门失败` / `拉取企微成员失败`。

---

### 10.9 通讯录拉取（旧口径保留）

**请求**

```
POST /admin/wecom/pull-contacts
```

拉取 upsert 但**不自动置 inactive** → `{"departmentsCreated":1,"departmentsUpdated":0,"employeesCreated":2,"employeesUpdated":13}`。

---

### 10.10 手动触发一轮派发

**请求**

```
POST /admin/wecom/dispatch-messages
```

→ `{"sent":[消息对象...],"failed":[{"id":9,"error":"..."}]}`；写日志 `wecom.messages_dispatched`。

---

## 十一、员工管理 / 工作台 / 日志 / 上传 / 导出

### 11.1 员工列表（管理端）

**请求**

```
GET /admin/employees?keyword={keyword}&departmentId={departmentId}&status={status}&page={page}&pageSize={pageSize}
```

| 查询参数        | 类型   | 必填 | 默认值 | 说明                                |
| --------------- | ------ | ---- | ------ | ----------------------------------- |
| keyword         | String | 否   | 不过滤 | 姓名模糊                            |
| departmentId    | Long   | 否   | 不过滤 | 部门精确                            |
| status          | String | 否   | 不过滤 | active / inactive                   |
| page / pageSize | int    | 否   | **全量** | 不传分页时 rows 返回全量（小表口径） |

**响应 `data`：`PageResult`**，`rows` 为 `List<Employee>`；department_admin 仅返回辖内。

**Employee 结构**

| 字段             | 类型    | 说明                                          |
| ---------------- | ------- | --------------------------------------------- |
| id               | Long    | 员工 ID                                       |
| wecomUserId      | String  | 企微 UserId                                   |
| name             | String  | 姓名                                          |
| departmentId / departmentName | Long / String | 直属部门           |
| pointsBalance    | Integer | 可用积分（兼容冗余字段）                      |
| availablePoints  | Integer | 可用积分（文档契约字段，=pointsBalance）      |
| cumulativePoints | Integer | 累计积分（终身荣誉分，只增不减，仅人工扣分可减） |
| status           | String  | active / inactive（inactive 不可登录/兑换/被勾选为投票参与人） |
| createdAt        | String  | 入库时间                                      |

---

### 11.2 待办角标（聚合）

**请求**

```
GET /admin/badges
```

**响应 `data`**（四类待审聚合键，与审核中心各 Tab 待审数同口径；辖内裁剪）：

```json
{ "code": 1, "msg": "成功",
  "data": { "exchangePending": 2, "taskPending": 3, "applicationPending": 4, "appealPending": 1 } }
```

> 旧「未读数（appealsUnread 等）+ mark-seen 已读」语义已于 2026-10-10 废弃：徽标 = 四类待审合计，`POST /admin/badges/mark-seen` 接口下线。

### 11.3 工作台汇总

**请求**

```
GET /admin/dashboard/summary
```

**响应 `data`**：`{"employeeCount":45,"giftCount":6,"taskCount":3,"pending":{"orders":2,"taskClaims":3,"applications":4,"appeals":1}}`（taskCount=published 任务数；辖内裁剪）。

---

### 11.4 操作日志（管理端，分页）

**请求**

```
GET /admin/operation-logs?type={type}&startTime={startTime}&endTime={endTime}&action={action}&actorId={actorId}&page={page}&pageSize={pageSize}
```

| 查询参数        | 类型   | 必填 | 默认值 | 说明                                                   |
| --------------- | ------ | ---- | ------ | ------------------------------------------------------ |
| type            | String | 否   | 不过滤 | 六类分类：points/review/appeal/gift_task/vote/system   |
| startTime/endTime | String | 否  | 开区间 | 时间范围（yyyy-MM-dd HH:mm:ss；兼容 createdAfter/Before） |
| action          | String | 否   | 不过滤 | 动作精确匹配（域.动作，如 order.status_changed）       |
| actorId         | String | 否   | 不过滤 | 操作者 ID                                              |
| page / pageSize | int    | 否   | 1 / 50 | 分页                                                   |

**响应 `data`：`PageResult`**，`rows` 为 `List<OpLog>`（时间倒序；**日志永久留存，无删改接口**）：

| 字段            | 类型   | 说明                                             |
| --------------- | ------ | ------------------------------------------------ |
| id              | Long   | 日志 ID                                          |
| actorId         | String | 操作者（管理员/员工数字 ID 或 system）           |
| action          | String | 动作（域.动作，见附录）                          |
| payload         | Map    | 原始业务明细                                     |
| createdAt       | String | 时间                                             |
| actionText      | String | 动作中文（如 订单状态变更/任务奖励/申请到账）    |
| actorText       | String | 操作者中文（系统 / 姓名 (ID)）                   |
| businessSummary | String | 业务摘要（中文关键要素）                         |
| targetLabel     | String | 操作对象标签（如 订单#5001 / 礼品「保温杯」）    |
| remark          | String | 备注详情（payload 中的 remark/reviewRemark 等）  |
| traceId         | String | 链路标识 trace-{YYYYMMDD}-{业务键}               |
| resultText      | String | 处理结果（恒 成功）                              |

**响应示例**

```json
{
  "code": 1, "msg": "成功",
  "data": { "total": 1, "rows": [
    { "id": 501, "actorId": "1", "action": "order.status_changed",
      "payload": { "orderId": 5001, "fromStatus": "待审核", "toStatus": "已驳回", "giftName": "京东购物卡 100 元",
                   "employeeName": "张三", "reviewRemark": "礼品缺货" },
      "createdAt": "2026-10-10 10:05:00", "actionText": "订单状态变更", "actorText": "系统管理员 (1)",
      "businessSummary": "订单 ID:5001 状态从「待审核」变更为「已驳回」", "targetLabel": "订单#5001",
      "remark": "礼品缺货", "traceId": "trace-20261010-order-status-5001", "resultText": "成功" } ] }
}
```

---

### 11.5 ~ 11.8 数据导出（管理端，均返回 xlsx 流）

| 接口 | 筛选参数 | 列（定稿口径，不加不减） |
| ---- | -------- | ------------------------ |
| `GET /admin/reports/points-summary.xlsx` | 无 | 姓名、可用积分、累计积分（累计倒序） |
| `GET /admin/reports/employees.xlsx` | keyword/departmentId/status | 姓名、部门、可用积分、累计积分、状态 |
| `GET /admin/orders.xlsx` | status/employeeId/createdAfter/Before | 姓名、兑换商品、兑换时间 |
| `GET /admin/task-records.xlsx`（`/admin/reports/task-claims.xlsx` 等价保留） | status/employeeId/createdAfter/Before | 任务领取人、状态（进行中/待审核/已通过/已驳回）、任务名称、任务成果 |

> 兑换时间列格式 `yyyy-MM-dd HH:mm:ss`；文件名由前端拼接（含时间戳），后端不处理 Content-Disposition 文件名。

---

### 11.9 佐证图片上传（员工端）

**请求**

```
POST /miniapp/uploads
Content-Type: multipart/form-data
```

| 表单字段 | 类型 | 必填 | 说明                    |
| -------- | ---- | ---- | ----------------------- |
| file     | File | 是   | 图片，≤5MB（超限 413）  |

→ 201 `data: {"url":"/uploads/ev/uuid.png"}`（相对路径）。

---

### 11.10 静态资源

```
GET /uploads/**
```

公开读取（穿越防护 + 一年强缓存）；不存在 404 `{"message":"文件不存在"}`（存量静态契约，保留旧结构不套 BaseResult）。

---

## 十二、错误处理

### 12.1 全局异常处理

所有接口异常均通过全局异常处理器（`GlobalExceptionHandler`）统一处理：

```json
{ "code": 0, "msg": "错误信息", "data": null }
```

### 12.2 常见错误场景

| 错误场景         | 错误信息示例                                     |
| ---------------- | ------------------------------------------------ |
| 请求体不可读/缺参 | 参数格式不合法                                  |
| 备注底线校验     | 单笔奖惩积分必须填写变动原因备注 / 处理备注不能为空 |
| 重复审核         | 该申诉已处理完毕 / 该申请当前状态不可审核 / 该任务当前状态不可审核 |
| 状态机非法流转   | 订单状态不能从 待审核 变更为 已通过             |
| 礼品重名         | 礼品名称已存在（含已下架礼品）                  |
| 重复提交         | 操作过于频繁，请勿重复提交 / 已提交过投票，不能重复提交 |
| 企微同步         | 同步进行中，请稍候 / 拉取企微部门失败           |
| 上传超限         | 文件过大                                        |
| 系统内部错误     | 服务器错误                                      |

---

## 附录

### A. 角色与权限

| 角色 | 数据范围 | 内容管理（礼品/任务/规则/投票） |
| ---- | -------- | ------------------------------- |
| super_admin | 全局 | ✔ |
| hr_admin | 全局 | ✔ |
| department_admin | 仅辖内部门员工（admin_departments 配置） | ✘（403） |

### B. 状态枚举总表

| 域 | 取值 | 说明 |
| -- | ---- | ---- |
| 订单 | pending_review / approved / rejected | 审核通过即闭环终点；驳回退分 |
| 任务 | published / unpublished（deleted 内部软删值） | 新建默认 unpublished |
| 任务记录 | in_progress / pending_review / approved / rejected | 驳回可申诉 |
| 积分申请 | pending_review / approved / rejected | 驳回可申诉 |
| 申诉 | pending_review / approved / rejected | 一级审核；通过扣分流水自动补分 |
| 投票（派生） | not_started / in_progress / ended | 按 startTime/endTime/closed 与当前时间推导，不落库 |
| 礼品 | active / inactive | 下架后台可见可管理 |
| 员工 | active / inactive | inactive 不可登录/兑换；历史流水保留 |

### C. 积分流水 type 与 source_type 对照

| type（展示类型） | source_type（业务来源） | 说明 |
| ---------------- | ----------------------- | ---- |
| reward / penalty | manual_adjustment | 人工单笔奖惩（双积分同动） |
| reward / penalty | monthly_performance | 月度批量（按正负归入） |
| performance | task_reward | 任务奖励（双积分同加） |
| application | point_application | 申请到账（双积分同加） |
| exchange | mall_order | 兑换消耗（仅扣可用积分） |
| refund | mall_order_refund | 订单驳回退分（仅回可用积分） |
| reward | appeal_compensation | 申诉成立补分（双积分同加） |
| reversal | reversal | 冲正（对原流水双维度取反） |

### D. 操作日志 action 清单（域.动作）

`point_record.created`、`order.created`、`order.status_changed`、`appeal.created`、`appeal.reviewed`、`application.created`、`application.reviewed`、`gift.created/updated/stock_adjusted/published/unpublished/cover_uploaded`、`task.created/updated/published/unpublished/deleted/claimed/submitted`、`task.reviewed`、`vote.created/updated/closed/submitted/exported`、`rules.updated`、`rule.updated`、`wecom.contacts_synced/contacts_pulled/messages_dispatched`、`outbox.retried/retry_failed`、`auth.token_reuse`

日志 `type` 六类映射：points=`point_record.*`；review=`order.*`+`application.reviewed`+`task.reviewed`；appeal=`appeal.*`；gift_task=`gift.*`+`task.*`（除 task.reviewed）；vote=`vote.*`；system=其余。

### E. 消息类型（通知中心）

`point_changed`（积分变动，payload.pointRecordId 可作申诉 targetId）、`order_status`、`appeal_result`、`task_review`、`application_review`、`vote_invitation`（到点推送，点消息直达投票详情）。

---

**文档版本**: v4.2
**最后更新**: 2026-10-10

> v4.2 变更（小程序端契约对齐，R1~R6/R8；R7 AI 升级另行处理）：**R2 任务大厅**——`GET /miniapp/tasks` 增加 `scope=all|mine`，status 改为**个人视角状态**（open/in_progress/pending_review/approved/rejected）并附 `statusText`/`title` 别名，排序改截止临近在前；`claim` 返回任务行（in_progress）；新增小程序契约路由 `POST /miniapp/tasks/{id}/submit`（按任务 ID，`content` 必填非空，返回任务行 pending_review；旧 `/miniapp/task-claims/{id}/submit` 保留兼容）。**R3 投票**——列表附 `mode/submitted/deadline/expired`，员工端行回填 `relatedLabel`；详情附 `mode/submitted/statusText`，`options[].text`/`selectedOptionIds` 输出改名；新增 `POST /miniapp/votes/{id}/ballots` 契约路由（返回提交后详情）。**R4/R5**——申请/申诉行附 `statusText`；申诉行附 `resolution`（=resultRemark）与 `pointRecordId`（point_record 目标=targetId）。**R6 双积分**——home 附 `actualPoints`；排行榜两榜行均附 `availablePoints`/`actualPoints`。**R8 深链**——消息行附 `voteId`（payload 提取）。**口径差异说明（小程序侧适配点）**：响应仍为 `BaseResult{code,msg,data}` 与分页 `{total,rows}`；时间统一 `yyyy-MM-dd HH:mm:ss`（东八区）；冲突类错误统一 400（不引入 409）；申请/申诉待审状态值为 `pending_review`（非 pending）；`GET /miniapp/hall`、`hall/unread-count` 前端已不消费，接口保留。

> v4.1 变更（前端联调反馈处理）：① 投票列表行新增 `participantIds`（编辑投票回填选人框，重名员工场景必须按 ID 回填）；② 申诉列表行新增 `targetSummary {title, content, reviewRemark}`（四类目标统一摘要，任务/申请/订单类申诉不再"盲审"）；③ point-records.xlsx 列头「实时/实际积分变动」更名「可用/累计积分变动」（employees.xlsx 同步），部门/来源等扩展列确认为保留口径；④ 投票 `relatedLabel` 由后端填充友好文本（如 `任务 #7 · 整理客户回访文档`）；⑤ badges 收敛为四类待审聚合键 `{exchangePending, taskPending, applicationPending, appealPending}`，旧未读键与 `POST /admin/badges/mark-seen` 随未读语义废弃下线（admin_seen 表不再建）。

> v4.0 变更（管理端前端文档对齐 + 文档结构重构）：① 接口契约对齐管理端前端需求文档定稿——登录 `token` 字段与管理端 access 12h；时间输出 `yyyy-MM-dd HH:mm:ss`（东八区）；企微 `sync-contacts` 拉取式（自动 inactive/防重入/四计数）；订单三态+`remark` 字段名+待审置顶；申诉一级三态+通过自动补分（appeal_compensation）+`pointRecordId`；申请路由 `/admin/applications`+`pending_review`+`reason/reviewedBy/evidenceImages[]`；流水 type 口径（performance/application）；任务 `published/unpublished`/`deadline`/`POST {id}/delete`/记录路由 `/admin/task-records`（+taskId 筛选）/状态四值/`submittedAt`/`submissionText|Images`/截止日提交拦截；礼品名称唯一（含已下架）；投票 `update|stats|stats.xlsx` 路由/`title` 参数/派生状态三值/纯字符串 options/VO 契约字段/统计 VO 口径/close 已结束 400；规则单对象 `/admin/rules`（100KB）；员工 `availablePoints`+全量模式；badges 聚合键；日志 `type` 六类+`startTime/endTime`+`targetLabel/remark`；五个导出定稿。② 文档结构按模块章节化重排：接口编号化，逐接口补参数表/响应字段表/响应示例/错误场景，新增状态枚举、流水类型对照、action 清单等附录。③ 项目未部署无存量库，`db/01-schema.sql`+`02-seed.sql` 即全新口径。
