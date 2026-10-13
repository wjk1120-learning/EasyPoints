import type { AdjustmentPayload, MonthlyBatchPayload } from "./types"
import type { PointRecord } from "../report/types"
import { post } from "../../utils/request"

/** 积分录入 REST 路径（契约见 docs/Easy-Points-API.md 3.1~3.3） */
export const PointsApi = {
  Adjustment: "/admin/points/adjustment",
  MonthlyBatch: "/admin/points/monthly-batch",
  /** 单条流水冲正（积分纠错唯一途径；原流水不可改删） */
  Reverse: (id: number | string) => `/admin/points/${id}/reverse`,
} as const

export type { AdjustmentPayload, MonthlyBatchPayload } from "./types"
export type { PointRecord } from "../report/types"

/** 单笔奖惩加减分（3.1：备注必填后端强校验；返回入账流水） */
export function adjustment(payload: AdjustmentPayload): Promise<PointRecord> {
  return post<PointRecord>(PointsApi.Adjustment, payload)
}

/** 月度批量录分（3.2：任一校验失败整体回滚；返回入账流水数组） */
export function monthlyBatch(payload: MonthlyBatchPayload): Promise<PointRecord[]> {
  return post<PointRecord[]>(PointsApi.MonthlyBatch, payload)
}

/** 冲正（3.3：生成反向流水，remark 必填；重复冲正后端 400） */
export function reversePointRecord(recordId: number | string, remark: string): Promise<PointRecord> {
  return post<PointRecord>(PointsApi.Reverse(recordId), { remark })
}
