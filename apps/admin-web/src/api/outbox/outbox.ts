import type { Paged } from "../types"
import type { OutboxMessage, OutboxMeta, OutboxQuery, OutboxRetryFailedQuery } from "./types"
import { get, post } from "../../utils/request"

/** outbox REST 路径（契约见 docs/Easy-Points-API.md 10.4~10.7） */
export const OutboxApi = {
  List: "/admin/outbox",
  Meta: "/admin/outbox/meta",
  RetryOne: (id: number | string) => `/admin/outbox/${id}/retry`,
  RetryFailed: "/admin/outbox/retry-failed",
} as const

/** outbox 分页（10.4；id 倒序，含 failReason 失败原因） */
export function outboxPaged(params: OutboxQuery): Promise<Paged<OutboxMessage>> {
  return get<Paged<OutboxMessage>>(OutboxApi.List, { ...params })
}

/** outbox meta（10.5：类型计数/worker 配置/待处理失败数） */
export function outboxMeta(): Promise<OutboxMeta> {
  return get<OutboxMeta>(OutboxApi.Meta)
}

/** 单条人工重试（10.6：→ pending 且重试计数归零、清空失败原因；仅辖内员工的消息） */
export function retryOutboxOne(id: number | string): Promise<OutboxMessage> {
  return post<OutboxMessage>(OutboxApi.RetryOne(id))
}

/** 批量重试 failed（10.7：可选 type/employeeId 过滤；返回重置条数；同步重置计数与失败原因） */
export function retryOutboxFailed(params: OutboxRetryFailedQuery = {}): Promise<{ count: number }> {
  return post<{ count: number }>(OutboxApi.RetryFailed, { ...params })
}
