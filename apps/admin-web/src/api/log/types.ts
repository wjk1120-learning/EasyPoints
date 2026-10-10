/** log 域类型：操作日志及查询参数 */

/** 操作日志（traceId/中文动作/操作人为后端 enrich 字段；payload 为原始明细，用于推导操作对象与备注详情） */
export interface OperationLog {
  id: number
  traceId?: string
  action: string
  actionText?: string
  actorText?: string
  businessSummary?: string
  resultText?: string
  createdAt: string
  /** 原始明细对象（后端 enrich 时透传），含 orderId/id/remark 等按 action 而定的键 */
  payload?: Record<string, unknown>
  /** 操作对象（展示用）：真实日志由前端按 action+payload 推导，投票日志为「投票「标题」」 */
  targetLabel?: string
  /** 备注详情（展示用）：真实日志由前端从 payload 推导，投票日志为所选选项/关联业务 */
  remark?: string
}

/** 日志查询参数（时间/类型筛选待后端扩展，见阶段 6） */
export interface LogQuery {
  page?: number
  pageSize?: number
}
