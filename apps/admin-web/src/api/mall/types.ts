/** 礼品与兑换订单类型（订单在 ../order 域） */

export interface Gift {
  id: number
  name: string
  pointsCost: number
  stock: number
  /** null 表示不限购 */
  limitPerUser: number | null
  /** active=上架 / inactive=下架 */
  status: "active" | "inactive" | string
  /** 形如 /uploads/xxx.png，展示时拼 API_BASE */
  coverImageUrl?: string
  createdAt?: string
  updatedAt?: string
}

export interface GiftPayload {
  name: string
  pointsCost: number
  stock: number
  limitPerUser: number | null
  status: "active" | "inactive" | string
}
