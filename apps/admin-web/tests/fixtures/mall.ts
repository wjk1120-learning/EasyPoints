/**
 * mall 域测试 fixture：字段与时间格式严格按 docs/Easy-Points-API.md 4.1 Gift 结构（响应示例）。
 */

export const GIFTS_FIXTURE = [
  {
    id: 1,
    name: "京东购物卡 100 元",
    pointsCost: 1000,
    stock: 20,
    status: "active",
    limitPerUser: 2,
    coverImageUrl: "/uploads/gifts/1/cover-a1b2.png",
    createdAt: "2026-09-01 09:00:00",
    updatedAt: "2026-10-08 18:00:00",
  },
  {
    id: 2,
    name: "保温杯（下架品）",
    pointsCost: 300,
    stock: 0,
    status: "inactive",
    limitPerUser: null,
    coverImageUrl: "",
    createdAt: "2026-09-02 09:00:00",
    updatedAt: "2026-10-09 10:00:00",
  },
] as const

/** 调库存后的礼品（+5） */
export const GIFT_STOCK_ADJUSTED = { ...GIFTS_FIXTURE[0], stock: 25, updatedAt: "2026-10-13 10:30:00" } as const
