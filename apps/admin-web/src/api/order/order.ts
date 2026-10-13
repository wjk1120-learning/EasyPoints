import type { Paged } from "../types"
import type { Order, OrderQuery, OrderStatusPayload } from "./types"
import { download, get, post } from "../../utils/request"

/** 兑换订单 REST 路径（契约见 docs/Easy-Points-API.md 4.10~4.11/11.7；三态状态机，无发货） */
export const OrderApi = {
  List: "/admin/orders",
  Status: (id: number | string) => `/admin/orders/${id}/status`,
  OrdersXlsx: "/admin/orders.xlsx",
} as const

export type { Order, OrderQuery, OrderStatusPayload } from "./types"

/** 全量订单（4.10：恒 PageResult 包装；量级小的前端过滤场景：兑换记录抽屉、工作台回退计数） */
export async function orders(): Promise<Order[]> {
  const res = await get<Paged<Order>>(OrderApi.List)
  return res.data
}

/** 分页订单列表（4.10：待审核置顶、同状态创建倒序由后端保证；支持状态/员工/创建时间筛选） */
export function ordersPaged(params: OrderQuery): Promise<Paged<Order>> {
  return get<Paged<Order>>(OrderApi.List, { ...params })
}

/**
 * 订单审核（4.11：approved=闭环终点 / rejected=同事务自动退分+回补库存；
 * 驳回 remark 必填由页面强校验，后端兜底 400「处理备注不能为空」）
 */
export function updateOrder(id: number | string, payload: OrderStatusPayload): Promise<unknown> {
  return post<unknown>(OrderApi.Status(id), payload)
}

/** 导出兑换记录表 Excel（11.7：姓名/兑换商品/兑换时间；文件名由前端拼接） */
export function exportOrdersXlsx(params: { employeeId?: number | string; status?: string } = {}): Promise<Blob> {
  return download(OrderApi.OrdersXlsx, { ...params })
}
