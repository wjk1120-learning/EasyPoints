/** report 域类型：积分流水与查询参数（契约见 docs/Easy-Points-API.md 3.4 PointRecord 结构） */

/** 积分流水（不可篡改；纠错走 reversal 冲正流水） */
export interface PointRecord {
  id: number
  employeeId: number
  employeeName?: string
  /** 可用积分变动 */
  pointsDelta: number
  /** 累计积分变动（双积分流水；旧后端缺失时页面兜底 = pointsDelta） */
  cumulativePointsDelta?: number
  type: "reward" | "penalty" | "performance" | "exchange" | "refund" | "reversal" | string
  operatorId?: number
  operatorName?: string
  occurredAt: string
  createdAt?: string
  /** 备注：所有流水必带（业务底线） */
  remark: string
  sourceType?: string
  sourceId?: string
  reversalOfId?: number
}

/** 流水查询参数（文档 3.4：month/employeeId 均选填） */
export interface RecordQuery {
  page?: number
  pageSize?: number
  /** 员工 ID */
  employeeId?: number | string
  /** 月份 YYYY-MM */
  month?: string
}
