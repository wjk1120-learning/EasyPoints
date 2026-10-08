/** appeal 域类型：申诉工单及审核参数 */
import type { PointRecord } from "../report/types"

export interface Appeal {
  id: number
  employeeId: number
  employeeName?: string
  pointRecordId: number
  /** 关联的原积分流水（含备注/分值） */
  pointRecord?: PointRecord
  /** 申诉理由 */
  reason: string
  status:
    | "pending_department_review"
    | "pending_hr_review"
    | "department_approved"
    | "hr_approved"
    | "rejected"
    | string
  resultRemark?: string
  createdAt?: string
  updatedAt?: string
}

/** 申诉列表查询参数 */
export interface AppealQuery {
  page?: number
  pageSize?: number
  status?: string
  employeeId?: number | string
}

/** 审核申诉：处理意见必填，全程留痕 */
export interface AppealReviewPayload {
  status: "department_approved" | "hr_approved" | "rejected"
  stage: "department" | "hr"
  resultRemark: string
}
