/** order 域类型：兑换订单（契约见 docs/Easy-Points-API.md 4.8~4.9） */

export interface Order {
  id: number | string
  giftId?: number | string
  giftName?: string
  pointsCost?: number
  pointsSpent?: number
  /** pending_review / approved（闭环终点）/ rejected / cancelled */
  status?: string
  /** 审核备注（驳回必填；存储列 review_remark，契约输出名 remark——P4 起前端读 remark） */
  remark?: string
  createdAt?: string
  occurredAt?: string
}
