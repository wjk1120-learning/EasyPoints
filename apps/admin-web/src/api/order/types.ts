/** order 域类型：兑换订单及状态流转参数 */

export interface Order {
  id: number
  employeeId: number
  /** 员工姓名（契约要求后端返回；未返回时前端用员工列表兜底映射） */
  employeeName?: string
  giftId?: number
  giftName: string
  pointsCost: number
  status: "pending_review" | "approved" | "shipped" | "completed" | "rejected" | "cancelled" | string
  /** 审核备注/驳回原因 */
  remark?: string
  createdAt?: string
  updatedAt?: string
}

/** 订单列表查询参数 */
export interface OrderQuery {
  page?: number
  pageSize?: number
  status?: string
  employeeId?: number | string
}

/** 更新订单状态：驳回/取消时 remark 必填（页面强校验） */
export interface OrderStatusPayload {
  status: string
  remark: string
}
