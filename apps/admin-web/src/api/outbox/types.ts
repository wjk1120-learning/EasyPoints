/** outbox 域类型：消息派发运维（契约见 docs/Easy-Points-API.md 10.4~10.7） */

/** outbox 消息（后端 MessageOutboxEntity 原样返回；payload 为 JSON 字符串） */
export interface OutboxMessage {
  id: number
  employeeId: number
  /** 消息类型：point_changed/order_status/appeal_result/task_review/application_review/vote_invitation */
  type: string
  /** 消息体 JSON 字符串（流水 ID、分值、备注等业务字段，按 type 而定） */
  payload: string
  /** 投递状态：pending=待投 / processing=投递中 / sent=已送达 / failed=失败 */
  status: "pending" | "processing" | "sent" | "failed" | string
  /** 已重试次数 */
  retryCount: number
  /** 最近一次派发失败原因（errcode+errmsg+人话提示；派发成功/人工重试后为 null） */
  failReason?: string | null
  readAt?: string | null
  createdAt: string
  updatedAt: string
}

/** outbox 列表查询参数（契约 10.4：均选填，后端按管理员辖内部门裁剪） */
export interface OutboxQuery {
  page?: number
  pageSize?: number
  status?: string
  type?: string
  employeeId?: number
}

/** 批量重试 failed 参数（省略即全部 failed；受辖内裁剪） */
export interface OutboxRetryFailedQuery {
  type?: string
  employeeId?: number
}
