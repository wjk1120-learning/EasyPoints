/** outbox 域类型：消息派发运维 */

export interface OutboxMessage {
  id: number
  type: "point_changed" | "order_status" | "appeal_result" | string
  employeeId: number
  status: "pending" | "processing" | "mock_sent" | "failed" | string
  retryCount: number
  payload?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** Outbox 列表查询参数 */
export interface OutboxQuery {
  page?: number
  pageSize?: number
  status?: string
  type?: string
  employeeId?: number | string
}

/** Outbox 元信息：可用类型 + 运维配置 */
export interface OutboxMeta {
  types: string[]
  config: {
    processingTimeoutSec: number
    maxRetries: number
    batchSize: number
  }
}

/** 批量重置 failed 消息的请求与响应 */
export interface RetryFailedPayload {
  type?: string
  employeeId?: number | string
}

export interface RetryFailedResult {
  count: number
}

/** 立即派发结果 */
export interface DispatchResult {
  sent: number
  failed: number
}
