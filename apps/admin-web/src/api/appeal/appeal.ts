import type { Paged } from "../types"
import type { Appeal, AppealQuery, AppealReviewPayload } from "./types"
import { get, post } from "../../utils/request"

/** 申诉工单 REST 路径（apps/api/src/app.js；两级审核：部门初审 → 人事复核） */
export const AppealApi = {
  List: "/admin/appeals",
  Review: (id: number | string) => `/admin/appeals/${id}/review`,
} as const

export function appeals(): Promise<Appeal[]> {
  return get<Appeal[]>(AppealApi.List)
}

export function appealsPaged(params: AppealQuery): Promise<Paged<Appeal>> {
  return get<Paged<Appeal>>(AppealApi.List, { ...params })
}

/** 审核申诉：处理意见必填，结果推送员工通知 */
export function reviewAppeal(id: number | string, payload: AppealReviewPayload): Promise<unknown> {
  return post<unknown>(AppealApi.Review(id), payload)
}
