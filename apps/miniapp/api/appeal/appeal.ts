import type { AppealCreatePayload, Appeal } from "./types"
import { request } from "../../utils/request"

/** 申诉 REST 路径（契约见 docs/Easy-Points-API.md 7.1~7.2） */
export const AppealApi = {
  List: "/miniapp/appeals",
} as const

export type { Appeal, AppealCreatePayload } from "./types"

/** 我的申诉（7.2：现状按数组解析——第 3 阶段切 PageResult） */
export function fetchAppeals(): Promise<Appeal[]> {
  return request<Appeal[]>(AppealApi.List)
}

/** 提交申诉（7.1：payload 现状 { pointRecordId, reason } 老口径——第 3 阶段切 { targetType, targetId, reason }；重复申诉 400） */
export function createAppeal(payload: AppealCreatePayload): Promise<Appeal> {
  return request<Appeal>(AppealApi.List, { method: "POST", data: payload })
}
