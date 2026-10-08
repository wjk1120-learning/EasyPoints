/** log 域类型：操作日志及查询参数 */

/** 操作日志（traceId/中文动作/操作人为后端 enrich 字段） */
export interface OperationLog {
  id: number
  traceId?: string
  action: string
  actionText?: string
  actorText?: string
  businessSummary?: string
  resultText?: string
  createdAt: string
}

/** 日志查询参数（时间/类型筛选待后端扩展，见阶段 6） */
export interface LogQuery {
  page?: number
  pageSize?: number
}
