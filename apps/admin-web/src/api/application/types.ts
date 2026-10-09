/** application 域类型：积分申请（员工贡献申报）与审核 */
import type { Paged } from "../types"

/** 积分申请工单：员工自主申报工作突出/重大贡献，管理员审核后双积分到账（PRD 4.6 / 5.2） */
export interface Application {
  id: number
  employeeId: number
  employeeName?: string
  /** 申请分值（正整数） */
  points: number
  /** 申请缘由（必填） */
  reason: string
  /** 佐证图片 URL 列表（选填） */
  evidenceImages?: string[]
  status: "pending_review" | "approved" | "rejected" | string
  /** 审核意见：驳回时必填（PRD 3.2） */
  reviewRemark?: string
  reviewedBy?: string
  createdAt: string
  updatedAt: string
}

/** 申请列表查询参数 */
export interface ApplicationQuery {
  page?: number
  pageSize?: number
  status?: string
  employeeId?: number | string
}

/** 审核请求：通过/驳回 + 意见（驳回必填） */
export interface ApplicationReviewPayload {
  status: "approved" | "rejected"
  remark: string
}
