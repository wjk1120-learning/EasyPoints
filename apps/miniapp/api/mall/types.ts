/** mall 域类型：上架礼品（契约见 docs/Easy-Points-API.md 4.7，仅 active 礼品；库存 0 前端置灰） */

export interface Gift {
  id: number | string
  name?: string
  pointsCost?: number
  stock?: number
  status?: string
  coverImageUrl?: string
  deliveryType?: string
  type?: string
  electronic?: boolean
}
