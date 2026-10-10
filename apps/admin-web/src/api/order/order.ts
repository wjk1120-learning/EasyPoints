import type { Paged } from "../types"
import type { Order, OrderQuery, OrderStatusPayload } from "./types"
import { download, get, post } from "../../utils/request"

/** 兑换订单 REST 路径（apps/api/src/app.js；审核通过后仍有发货/核销流转） */
export const OrderApi = {
  List: "/admin/orders",
  Status: (id: number | string) => `/admin/orders/${id}/status`,
  /** 兑换记录表导出（后端待实现，契约见 docs/admin-web-api-requirements.md 3.9） */
  OrdersXlsx: "/admin/orders.xlsx",
} as const

export function orders(): Promise<Order[]> {
  return get<Order[]>(OrderApi.List)
}

export function ordersPaged(params: OrderQuery): Promise<Paged<Order>> {
  return get<Paged<Order>>(OrderApi.List, { ...params })
}

/** 更新订单状态：approved/shipped/rejected/cancelled；驳回会自动生成退分流水 */
export function updateOrder(id: number | string, payload: OrderStatusPayload): Promise<unknown> {
  return post<unknown>(OrderApi.Status(id), payload)
}

/** 导出兑换记录表 Excel：文件由后端生成（前端只触发下载；后端待实现，契约 3.9） */
export function exportOrdersXlsx(params: { employeeId?: number | string; status?: string } = {}): Promise<Blob> {
  return download(OrderApi.OrdersXlsx, { ...params })
}
