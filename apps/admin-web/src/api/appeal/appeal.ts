import type { Paged } from "../types"
import type { Appeal, AppealQuery, AppealReviewPayload } from "./types"
import { get, post } from "../../utils/request"

/** 申诉工单 REST 路径（apps/api/src/app.js；两级审核：部门初审 → 人事复核） */
export const AppealApi = {
  List: "/admin/appeals",
  Review: (id: number | string) => `/admin/appeals/${id}/review`,
} as const

/** 全量申诉（7.3：恒 PageResult 包装；工作台回退计数用） */
export async function appeals(): Promise<Appeal[]> {
  const res = await get<Paged<Appeal>>(AppealApi.List)
  return res.data
}

export function appealsPaged(params: AppealQuery): Promise<Paged<Appeal>> {
  return get<Paged<Appeal>>(AppealApi.List, { ...params })
}

/** 审核申诉：处理备注必填，结果推送员工通知 */
export function reviewAppeal(id: number | string, payload: AppealReviewPayload): Promise<unknown> {
  return post<unknown>(AppealApi.Review(id), payload)
}
