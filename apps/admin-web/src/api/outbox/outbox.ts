import type {
  DispatchResult,
  OutboxMeta,
  OutboxMessage,
  OutboxQuery,
  RetryFailedPayload,
  RetryFailedResult,
} from "./types"
import type { Paged } from "../types"
import { get, post } from "../../utils/request"

/** 消息 Outbox 运维 REST 路径（apps/api/src/app.js） */
export const OutboxApi = {
  List: "/admin/outbox",
  Meta: "/admin/outbox/meta",
  Retry: (id: number | string) => `/admin/outbox/${id}/retry`,
  RetryFailed: "/admin/outbox/retry-failed",
  Dispatch: "/admin/wecom/dispatch-messages",
} as const

export function outboxPaged(params: OutboxQuery): Promise<Paged<OutboxMessage>> {
  return get<Paged<OutboxMessage>>(OutboxApi.List, { ...params })
}

export function outboxMeta(): Promise<OutboxMeta> {
  return get<OutboxMeta>(OutboxApi.Meta)
}

/** 单条重试：重置为待派发 */
export function retryOutbox(id: number | string): Promise<unknown> {
  return post<unknown>(OutboxApi.Retry(id))
}

/** 批量重置 failed 消息（可按类型/员工过滤），返回重置条数 */
export function retryOutboxFailed(payload: RetryFailedPayload = {}): Promise<RetryFailedResult> {
  return post<RetryFailedResult>(OutboxApi.RetryFailed, payload)
}

/** 立即派发 pending 消息，返回派发/失败条数 */
export function dispatchOutbox(): Promise<DispatchResult> {
  return post<DispatchResult>(OutboxApi.Dispatch)
}
