# API 摘要

## 管理端

- `POST /admin/auth/login`：账号密码登录。
- `GET /admin/employees`：员工列表。
- `POST /admin/points/adjustment`：单笔奖惩积分，`remark` 必填。
- `POST /admin/points/monthly-batch`：月度批量录分，支持 `batchRemark` 和单人 `remark`。
- `POST /admin/points/{id}/reverse`：用冲正流水纠错，原流水不修改。
- `GET /admin/reports/point-records`：导出/查询带备注积分明细。
- `GET /admin/operation-logs`：操作日志。
- `GET /admin/appeals` / `POST /admin/appeals/{id}/review`：申诉审核。
- `GET /admin/orders` / `POST /admin/orders/{id}/status`：订单审核、发货、驳回退分。
- `POST /admin/wecom/sync-contacts`：企业微信通讯录同步入口。
- `POST /admin/wecom/dispatch-messages`：企业微信消息 outbox 发送入口，当前骨架为 mock sent。

## 员工端

- `GET /miniapp/home`：首页积分、月度变动、通知数量。
- `GET /miniapp/messages`：员工通知列表（可选 query：`unreadOnly=1` 仅返回未读）。
- `POST /miniapp/messages/{id}/read`：将单条通知标记为已读。
- `POST /miniapp/messages/read-all`：将当前员工通知全部标记为已读。
- `GET /miniapp/points/records`：按月份分组的积分流水，包含完整备注。
- `POST /miniapp/appeals`：基于本人积分流水提交申诉。
- `GET /miniapp/mall/gifts`：可兑换礼品。
- `POST /miniapp/orders`：提交兑换订单并扣除积分。
- `GET /miniapp/orders`：我的订单。

## 关键约束

- 后端不提供积分流水删除接口。
- 后端不提供积分流水备注修改接口。
- 数据库 `point_records` 使用触发器禁止 `UPDATE` 和 `DELETE`。
- 需要纠错时调用冲正接口生成反向流水。
