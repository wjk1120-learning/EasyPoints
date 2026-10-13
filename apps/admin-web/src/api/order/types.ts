/** order 域类型：兑换订单（契约见 docs/Easy-Points-API.md 4.10 Order 结构；三态状态机，审核通过即闭环终点） */

export interface Order {
  id: number
  employeeId: number
  /** 员工姓名（列表行 join 带出） */
  employeeName?: string
  giftId: number
  /** 礼品名快照 */
  giftName: string
  /** 成交积分快照 */
  pointsCost: number
  status: "pending_review" | "approved" | "rejected" | string
  /** 审核备注（驳回必填） */
  remark?: string
  createdAt?: string
  updatedAt?: string
}

/** 订单列表查询参数（文档 4.10，均选填） */
export interface OrderQuery {
  page?: number
  pageSize?: number
  status?: string
  employeeId?: number | string
  createdAfter?: string
  createdBefore?: string
}

/** 订单审核（4.11：approved / rejected；驳回必填 remark，同事务自动退分+回补库存） */
export interface OrderStatusPayload {
  status: "approved" | "rejected" | string
  remark: string
}
