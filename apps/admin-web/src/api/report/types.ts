/** report 域类型：积分流水与查询参数 */

/** 积分流水（不可篡改；纠错走 reversal 冲正流水） */
export interface PointRecord {
  id: number
  employeeId: number
  employeeName?: string
  pointsDelta: number
  type: "reward" | "penalty" | "performance" | "exchange" | "refund" | "reversal" | string
  operatorName?: string
  occurredAt: string
  /** 备注：所有流水必带（业务底线） */
  remark: string
  sourceType?: string
  sourceId?: number
  reversalOfId?: number
}

/** 流水查询参数 */
export interface RecordQuery {
  page?: number
  pageSize?: number
  /** 员工 ID */
  employeeId?: number | string
  /** 月份 YYYY-MM */
  month?: string
}
