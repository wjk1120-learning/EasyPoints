/** application 域类型：积分申请（契约见 docs/Easy-Points-API.md 6.3 Application 结构） */
import type { Paged } from "../types"

/** 积分申请工单：员工自主申报贡献，审核通过双积分到账（PRD 4.6 / 5.2） */
export interface Application {
  id: number
  employeeId: number
  employeeName?: string
  /** 申请分值（正整数） */
  points: number
  /** 贡献描述（存储列 description，输出名 reason） */
  reason: string
  /** 佐证图 URL 数组（选填） */
  evidenceImages?: string[]
  status: "pending_review" | "approved" | "rejected" | string
  /** 状态中文（待审核/已通过/已驳回，后端计算字段） */
  statusText?: string
  /** 审核备注（驳回必填） */
  reviewRemark?: string
  /** 审核管理员 ID */
  reviewerId?: number
  /** 审核人姓名（join 带出，未审核为 null） */
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

/** 申请列表查询参数（文档 6.3） */
export interface ApplicationQuery {
  page?: number
  pageSize?: number
  status?: string
  employeeId?: number | string
  createdAfter?: string
}

/** 申请审核（文档 6.4：approved / rejected；驳回必填 remark，后端兜底 400「处理备注不能为空」） */
export interface ApplicationReviewPayload {
  status: "approved" | "rejected"
  remark: string
}
