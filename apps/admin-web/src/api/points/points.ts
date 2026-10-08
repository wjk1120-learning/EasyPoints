import type { AdjustmentPayload, MonthlyBatchPayload } from "./types"
import { post } from "../../utils/request"

/** 积分录入 REST 路径（apps/api/src/app.js） */
export const PointsApi = {
  Adjustment: "/admin/points/adjustment",
  MonthlyBatch: "/admin/points/monthly-batch",
  /** 单条流水冲正（阶段 6 拓展用） */
  Reverse: (id: number | string) => `/admin/points/${id}/reverse`,
} as const

/** 单笔奖惩加减分（备注必填，后端校验） */
export function adjustment(payload: AdjustmentPayload): Promise<unknown> {
  return post<unknown>(PointsApi.Adjustment, payload)
}

/** 月度批量录分 */
export function monthlyBatch(payload: MonthlyBatchPayload): Promise<unknown> {
  return post<unknown>(PointsApi.MonthlyBatch, payload)
}
