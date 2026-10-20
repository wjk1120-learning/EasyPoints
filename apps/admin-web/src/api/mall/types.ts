/** 礼品与兑换订单类型（订单在 ../order 域；契约见 docs/Easy-Points-API.md 4.1） */

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
  /** 库存（4.2/4.3：新建可空默认 0；编辑不覆盖库存——新后端忽略本字段，传原值兼容旧后端全字段覆盖） */
  stock?: number
  limitPerUser: number | null
  status: "active" | "inactive" | string
}
