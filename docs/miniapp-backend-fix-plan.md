# miniapp 后端反馈修复执行方案

> 针对 [miniapp-backend-feedback.md](./miniapp-backend-feedback.md) 的第 1/2/3 项「建议修复」逐项闭环。
> 范围已拍板（2026-10-14）：本轮只修 1/2/3；第 4/5 项（明细分页 + 已冲正标识）绑在一起，等本轮闭环后单独裁决；第 6 项已闭环不动。
> failed 未读口径已拍板：**三处统一为「可见即可读可计」**（列表筛选 / 首页未读数 countUnread / 批量已读 markAllRead 全部不再排除 failed）。

## 执行协议（每轮固定六步，严格串行）

1. 后端修改（改动点见轮次表）
2. 后端测试：`cd apps/Easy-Points && mvn test`（纯 JUnit5 + Mockito 单测，无需数据库，全绿才算过）
3. 重建重启后端：在 `apps/Easy-Points` 目录下 `docker compose up -d --build app`，健康检查 `http://localhost:3000/health`
4. 前端配合改动 + `cd apps/miniapp && npm test`（vitest 全绿）
5. 联调：curl 直打 3000 验 JSON + H5（5174）实际操作验证
6. **停点汇报三段式**：①改了什么（逐文件清单，供用户 git diff）②测试结果（mvn/npm 各几条、过没过）③用户自查步骤（去哪个页面→点什么→看到什么现象算通过，现象一眼可见）
   → **停下**：用户亲自测试确认 + 用户自己 commit（铁律：AI 不代跑 git commit），确认后才进下一轮。

## 联调环境

- `scripts/start-dev.ps1`：MySQL/Redis Docker（apps/Easy-Points 下 compose）→ 后端 app 容器（3000，dev profile 放开直登）→ admin-web（5173）→ miniapp H5（5174，vite 代理 `/miniapp` → localhost:3000）。
- 后端改动必须 `--build` 重建容器才生效；`target/classes` 有编译副本，改码以 `src/main` 为准。
- dev 登录：H5 普通浏览器直登 zhangsan；curl 可 `POST /miniapp/auth/login`（dev profile 兼容直登）拿 JWT 后带 `Authorization: Bearer`。
- 造数：`docker exec` 进 MySQL 容器，按 `src/main/resources/db/01-schema.sql` 实际列名 insert。

## 轮次表

### ✅/⬜ 轮次 1 = 反馈 #2：isRead 序列化成了 read

| 项 | 内容 |
|---|---|
| 后端 | `MessageVo.java:23` `private boolean isRead` 加 `@JsonProperty("isRead")`，JSON 输出回归契约 10.1 的 `isRead`（Jackson 3 仍按 Bean 规范剥 is 前缀） |
| 后端测试 | `MessageFormatterTest` 加用例：`JsonUtil.toJson(vo)` 断言含 `"isRead"`、不含裸 `"read"` |
| 前端配合 | `api/message/types.ts` 删 `read?` 双字段；`pages/messages/index.vue` 列表归一化删 `?? row.read`；`tests/components/messages.test.ts` 同步 |
| 联调 | curl `GET /miniapp/messages` 字段名为 `isRead`；H5 通知中心已读/未读渲染正常；npm test 全绿 |
| 用户自查 | H5 通知中心：已读灰/无红点、未读高亮。判据：前端兼容已删，后端没修好会「全部显示未读」。技术面 F12 Network 看 messages 响应字段名 |

- ✅ mvn test 全绿（102/102，含新增序列化用例；首版「仅加 @JsonProperty」被用例抓出双字段输出，改为字段名 read + 注解归并的终版）
- ✅ docker 重建 + curl 验证 isRead（无裸 read 字段）+ Playwright H5 实测（红点/未读行/头部文案与接口一致）
- ✅ npm test 全绿（96/96）+ typecheck 0 错误
- ⬜ 用户确认 + commit

### ✅/⬜ 轮次 2 = 反馈 #1 ★：全部已读排除 failed，红点清不掉

| 项 | 内容 |
|---|---|
| 后端 | `MessageOutboxMapper.xml` 四处 SQL 去掉 `and status != 'failed'`：`selectByEmployeePage:31`（unreadOnly 筛选）、`countByEmployee:41`、`countUnread:44-49`、`markAllRead:58-63`；`MessageOutboxMapper.java:33` 注释同步改「可见即可读可计」 |
| 后端测试 | `mvn test` 回归（Mapper XML 无单测护栏，联调实测兜底） |
| 前端配合 | `pages/messages/index.vue` `markAllRead()` 从「遍历逐条单标兜底」切回契约 10.3 `read-all`（`api/message/message.ts` 已有封装），删防重与注释；`tests/components/messages.test.ts` 「逐条单标」用例改回断言 read-all |
| 联调 | docker exec 造一条 `status='failed', read_at=null` → H5 可见未读 → 点「全部已读」count>0 → 列表全已读 → 首页未读数归零；npm test 全绿 |
| 用户自查 | 通知中心有未读（含我会造好的 failed 消息）→ 点「全部已读」→ 所有消息变已读、红点清零；回首页刷新未读数归 0。修复前点了没反应，修复后一点就清 |

- ✅ mvn test 回归全绿（102/102）
- ✅ docker 重建 + 造数 + API 全链路验证（home 未读数计 failed / unreadOnly=1 可见 / read-all count=3 / 清零）+ Playwright H5 交互验证（点全部已读 → 单次请求 → 红点清零 → 20/20 置灰 → 库内 0）
- ✅ npm test 全绿（96/96）+ typecheck 0 错误
- 附带发现（已留档反馈清单 #1）：Controller unreadOnly 按字符串 "1" 判断，前端 toQuery 布尔序列化为 "true"，当前无调用方，暂不改
- ⬜ 用户确认 + commit（自查数据已备好：zhangsan 名下 3 条 failed 未读，备注含「自查测试数据」字样）

### ✅/⬜ 轮次 3 = 反馈 #3：payload 4 个业务 ID 提升为消息行字段（申诉直达）

| 项 | 内容 |
|---|---|
| 后端 | `MessageVo.java` 仿 `voteId:35` 加 4 个 `Long`：`pointRecordId`/`orderId`/`claimId`/`applicationId`；`MessageFormatter.java` 仿 `extractVoteId:33-42` 无条件提取（payload 有就带出，互不冲突；task.submitted 顺带受益） |
| 后端测试 | `MessageFormatterTest`：4 类消息各构造带 ID payload，断言对应字段提升、其余为 null |
| 契约 | `docs/Easy-Points-API.md` 10.1 字段表补 4 个深链字段（版本注记 v4.4，向后兼容增量） |
| 前端配合 | 业务代码零改动（迁移时已按后端终态提前实现透传+申诉直达+降级+测试，设计为后端带出即生效）；仅 `api/message/types.ts` 「待后端带出」临时注释更新为正式说明 |
| 联调 | curl 确认 4 字段**真实带值**（防假修复）；4 类消息详情「发起申诉」直达 `/pages/appeal/index` 且预填 targetType/targetId，无 ID 降级仍正常；npm test 全绿 |
| 用户自查 | 每类点进一条消息详情 → 点「发起申诉」→ 直达申诉表单且「关联记录」自动带上（修复前跳积分明细等页面自己找）；再点 appeal_result 消息确认无申诉按钮 |

- ⬜ mvn test 全绿
- ⬜ 契约文档 v4.4 增量
- ⬜ docker 重建 + curl 4 字段带值
- ⬜ npm test 全绿
- ⬜ 用户确认 + commit

## 待裁决项（本轮闭环后）

- 反馈 #4（明细服务端分页）+ #5（已冲正反向标识）：必须绑在一起做（#5 依赖 #4 的分页口径），涉及契约 v4.4 与前端明细页改造，等用户裁决排期。
