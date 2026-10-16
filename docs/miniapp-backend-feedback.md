# miniapp 用户端联调后端反馈清单

> 员工端 miniapp 正按 `Easy-Points-API.md`（v4.3）逐页切换真实接口联调（后端 dev 环境）。以下为切换过程中发现的问题汇总，格式参照 [admin-web-backend-feedback.md](./admin-web-backend-feedback.md)。
> 前端均已做临时兼容，不阻塞联调；各项附后端源码出处，供评估排期。汇总日期：2026-10-14。

## 1.【建议修复】「全部已读」排除 failed 消息，与单条已读口径矛盾 ★

- **位置**：`MessageOutboxMapper.xml`——markAllRead :62（`and status != 'failed'`）、单条 markRead :55（无 status 条件）、countUnread :48
- **现象**：通知中心点「全部已读」，红点与未读数不变。员工消息全为 failed（企微推送失败）时 100% 复现——批量已读一条都命不中。
- **根因**：列表把 failed 行照常展示、`isRead=false` 显示为未读（`MessageOutboxMapper.java:33` 注释「列表展示含 failed，未读口径排除」），员工看得见的消息却清不掉红点；且单条已读可标 failed、批量已读不可标，两个接口自相矛盾。
- **前端临时处理**：不走契约 10.3 read-all，改为遍历未读逐条调单条已读接口兜底（Promise.allSettled + 防重）。
- **建议**：markAllRead 去掉 `status != 'failed'`，与单条已读对齐；countUnread 是否把 failed 计入未读建议一并对齐口径（推荐：消息对员工可见即可标已读、计未读）。

## 2.【建议修复】MessageVo 的 isRead 序列化成了 read

- **位置**：`MessageVo.java:23` `private boolean isRead;`
- **现象**：契约 10.1 写 `isRead`，实际 JSON 输出 `read`——Lombok getter `isRead()` 被 Jackson 按 Bean 规范剥掉 `is` 前缀。
- **前端临时处理**：列表行归一化 `isRead = isRead ?? read ?? false`。
- **建议**：字段加 `@JsonProperty("isRead")`，或改字段名后同步契约文档，二选一，别让文档和实现继续不一致。

## 3.【建议修复 · 前端已就绪】消息行带出 payload 里的业务 ID（申诉直达）

- **位置**：`MessageFormatter.java:33`（已有 payload.voteId 深链提取先例）
- **现状**：payload 里业务 ID 其实齐全——point_changed 带 `pointRecordId`（PointsLedgerServiceImpl :101）、order_status 带 `orderId`（OrderServiceImpl :191）、task_review 带 `claimId`（TaskClaimAdminServiceImpl :130）、application_review 带 `applicationId`（PointApplicationServiceImpl :171）；但 MessageVo 只把 voteId 提升为顶层字段，其余四类消息前端拿不到任何关联记录 ID。
- **影响**：消息详情「发起申诉」无法直达申诉表单（契约 7.1 要 targetType+targetId），只能降级为页面引导；积分变动消息也无法深链对应流水。
- **建议**：仿照 voteId，把上述 4 个 ID 按类型提升为消息行顶层字段（字段名与 payload 一致即可）。
- **前端**：已按目标口径实现——消息列表/详情透传这 4 个字段，有值即直达申诉表单并预填 targetType/targetId；无值自动降级为「去对应页面引导」。后端带出后零改动生效。

## 4.【建议评估】员工端积分明细接口无服务端分页

- **位置**：`MiniappPointController` `GET /miniapp/points/records`，返回 `Map<String, List<PointRecordItemVo>>` 按月分组的全量数据
- **前端临时处理**：客户端窗口化展示（每次追加 20 条），流水多时有性能隐患。
- **建议**：补 `page/pageSize` + `PageResult{total,rows}`；若此条落地，第 5 条的跨月反查将不可行，需一并处理。

## 5.【建议评估】明细行缺少「已冲正」反向标识

- **位置**：`PointRecordEntity` 只有正向 `reversalOfId`（冲正流水 → 原流水），反向关联（原流水 → 被哪条冲正）无字段
- **现象**：前端只能把冲正流水本身标出来，原流水始终显示「正常」，达不到 PRD「当前状态 = 已冲正」的展示要求。
- **建议**：`PointRecordItemVo` 加派生字段（如 `reversed`），后端一次 `where reversal_of_id in (...)` 即可；若第 4 条分页落地则为必需。

## 6.【已闭环 · 无需改动】任务驳回申诉 targetId 口径

- **疑问**：`targetType=task_claim` 时 targetId 传 taskId 还是领取记录 id。
- **结论**：后端按 `task_claims` 主键校验（`AppealServiceImpl` TASK_CLAIM 分支 selectById）；前端已通过 `GET /miniapp/task-claims?status=rejected` 按 taskId 匹配换算出 claim.id 再提交。仅留档，无需改动。
