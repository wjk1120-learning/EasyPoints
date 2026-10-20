/** message 域类型：通知中心消息（契约见 docs/Easy-Points-API.md 10.1~10.3 与附录 E） */

export interface Message {
  id: number | string
  /** 消息类型（附录 E：point_changed/order_status/appeal_result/task_review/application_review/vote_invitation/rule_update） */
  type?: string
  title?: string
  /** 摘要（富化后文案） */
  summary?: string
  isRead?: boolean
  readAt?: string
  /** 深链投票 ID（payload 含 voteId 时带出，点击直达投票详情；其余 null） */
  voteId?: number | string
  /** 深链业务 ID（契约 10.1/v4.4：后端从 payload 提升的顶层字段；有值时消息详情可直达申诉表单） */
  pointRecordId?: number | string
  orderId?: number | string
  claimId?: number | string
  applicationId?: number | string
  /** 深链规则 ID（payload 含 ruleId 时带出，rule_update 消息详情可去规则中心；其余 null） */
  ruleId?: number | string
  createdAt?: string
  updatedAt?: string
}
