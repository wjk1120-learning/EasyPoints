import type { Paged } from "../types"
import type { Appeal, AppealCreatePayload } from "./types"
import { request, requestPaged } from "../../utils/request"

/** 申诉 REST 路径（契约见 docs/Easy-Points-API.md 7.1~7.2） */
export const AppealApi = {
  List: "/miniapp/appeals",
} as const

export type { Appeal, AppealCreatePayload } from "./types"

/** 我的申诉（7.2：PageResult 分页；status 可选 pending_review/approved/rejected 服务端筛选） */
export function fetchAppeals(params: { status?: string; page?: number; pageSize?: number } = {}): Promise<Paged<Appeal>> {
  return requestPaged<Appeal>(AppealApi.List, params)
}

/** 提交申诉（7.1：{ targetType, targetId, reason[, evidenceImages] }；重复申诉 400「该记录已申诉过」） */
export function createAppeal(payload: AppealCreatePayload): Promise<Appeal> {
  return request<Appeal>(AppealApi.List, { method: "POST", data: payload })
}
