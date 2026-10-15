import type { Message } from "./types"
import { request } from "../../utils/request"

/** 消息 REST 路径（契约见 docs/Easy-Points-API.md 10.1~10.3） */
export const MessageApi = {
  List: "/miniapp/messages",
  Read: (id: number | string) => `/miniapp/messages/${id}/read`,
  ReadAll: "/miniapp/messages/read-all",
} as const

export type { Message } from "./types"

/** 我的消息（10.1：现状按数组解析——第 3 阶段切 PageResult + 分页） */
export function fetchMessages(): Promise<Message[]> {
  return request<Message[]>(MessageApi.List)
}

/** 标记单条已读（10.2） */
export function markMessageRead(id: number | string): Promise<unknown> {
  return request(MessageApi.Read(id), { method: "POST" })
}

/** 全部标记已读（10.3） */
export function markAllMessagesRead(): Promise<unknown> {
  return request(MessageApi.ReadAll, { method: "POST" })
}
