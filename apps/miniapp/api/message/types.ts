/** message 域类型：通知中心消息（契约见 docs/Easy-Points-API.md 10.1~10.3） */

export interface Message {
  id: number | string
  /** 消息类型（附录 E：point_changed/order_status/appeal_result/task_review/application_review/vote_invitation） */
  type?: string
  title?: string
  /** 摘要（富化后文案） */
  summary?: string
  isRead?: boolean
  readAt?: string
  /** 深链投票 ID（payload 含 voteId 时带出，点击直达投票详情；其余 null） */
  voteId?: number | string
  createdAt?: string
}
