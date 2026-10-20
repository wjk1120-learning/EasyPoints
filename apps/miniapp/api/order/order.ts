import type { Order } from "./types"
import { request } from "../../utils/request"

/** 订单 REST 路径（契约见 docs/Easy-Points-API.md 4.8~4.9） */
export const OrderApi = {
  List: "/miniapp/orders",
} as const

export type { Order } from "./types"

/** 我的订单（4.9：创建倒序；status 可选单值筛选） */
export function fetchOrders(status?: string): Promise<Order[]> {
  return request<Order[]>(status ? `${OrderApi.List}?status=${encodeURIComponent(status)}` : OrderApi.List)
}

/** 兑换下单（4.8：{ giftId }；仅扣实际积分，驳回同事务自动退分） */
export function createOrder(giftId: number | string): Promise<Order> {
  return request<Order>(OrderApi.List, { method: "POST", data: { giftId } })
}
