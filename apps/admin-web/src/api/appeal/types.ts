/** appeal 域类型：申诉工单（契约见 docs/Easy-Points-API.md 7.3/7.4；一级三态审核） */
import type { PointRecord } from "../report/types"

/** 被申诉原记录摘要（7.3：四类目标统一结构，审核申诉的上下文） */
export interface TargetSummary {
  /** 标题：任务名 / 申请缘由 / 礼品名 / 积分流水 #ID */
  title: string
  /** 内容说明：提交成果 / 申请分值 X 分 / 兑换积分 X 分 / 流水备注 */
  content: string
  /** 当时审核备注（驳回理由；扣分流水无此字段为 null） */
  reviewRemark: string | null
}

export interface Appeal {
  id: number
  /** 申诉目标：point_record / task_claim / order / point_application */
  targetType: "point_record" | "task_claim" | "order" | "point_application" | string
  /** 目标记录 ID */
  targetId: number
  /** 关联原流水 ID（仅 point_record 目标时 = targetId，其余 null） */
  pointRecordId?: number | null
  /** 关联原流水完整对象（含备注；仅 point_record 目标附带） */
  pointRecord?: PointRecord | null
  employeeId: number
  employeeName?: string
  /** 申诉理由 */
  reason: string
  /**
   * 佐证图（7.3：JSON 字符串存储且原样输出；展示时 JSON.parse，解析失败按空处理）
   */
  evidenceImages?: string | string[]
  /** 被申诉原记录摘要（审核上下文） */
  targetSummary?: TargetSummary
  status: "pending_review" | "approved" | "rejected" | string
  /** 状态中文（待审核/审核通过/已驳回，后端计算字段） */
  statusText?: string
  /** 处理意见（小程序契约别名，= resultRemark） */
  resolution?: string
  /** 审核管理员 */
  reviewerId?: number
  /** 处理备注（审核必填，员工可见） */
  resultRemark?: string
  createdAt?: string
  updatedAt?: string
}

/** 申诉列表查询参数（7.3，均选填） */
export interface AppealQuery {
  page?: number
  pageSize?: number
  status?: string
  employeeId?: number | string
  createdAfter?: string
}

/** 审核申诉（7.4：一级三态，无 stage 参数；resultRemark 必填，审核通过且目标为未冲正扣分流水时后端自动补分） */
export interface AppealReviewPayload {
  status: "approved" | "rejected"
  resultRemark: string
}
