import type { Paged } from "../types"
import type { Gift, GiftPayload } from "./types"
import { get, post, put, upload } from "../../utils/request"

/** 礼品商城 REST 路径（契约见 docs/Easy-Points-API.md 4.1~4.6） */
export const MallApi = {
  Gifts: "/admin/mall/gifts",
  Gift: (id: number | string) => `/admin/mall/gifts/${id}`,
  Stock: (id: number | string) => `/admin/mall/gifts/${id}/stock`,
  Publish: (id: number | string) => `/admin/mall/gifts/${id}/publish`,
  Unpublish: (id: number | string) => `/admin/mall/gifts/${id}/unpublish`,
  Cover: (id: number | string) => `/admin/mall/gifts/${id}/cover`,
} as const

/** 全量礼品列表（4.1：恒 PageResult 包装；下架礼品后台可见可管理，用户端隐藏） */
export async function mallGifts(): Promise<Gift[]> {
  const res = await get<Paged<Gift>>(MallApi.Gifts)
  return res.data
}

export function createGift(payload: GiftPayload): Promise<Gift> {
  return post<Gift>(MallApi.Gifts, payload)
}

/**
 * 编辑礼品（4.3：编辑不覆盖库存——后端忽略 stock；过渡期兼容旧后端全字段覆盖，调用方传原值）。
 */
export function updateGift(id: number | string, payload: GiftPayload): Promise<Gift> {
  return put<Gift>(MallApi.Gift(id), payload)
}

/** 调整库存（4.4：相对增减，正=补货、负=减库存；调整后为负后端 400），返回更新后的 Gift */
export function adjustGiftStock(id: number | string, delta: number): Promise<Gift> {
  return post<Gift>(MallApi.Stock(id), { delta })
}

export function publishGift(id: number | string): Promise<Gift> {
  return post<Gift>(MallApi.Publish(id))
}

export function unpublishGift(id: number | string): Promise<Gift> {
  return post<Gift>(MallApi.Unpublish(id))
}

/** 上传礼品封面（先保存礼品拿到 id；上限 5MB） */
export function uploadGiftCover(id: number | string, file: File): Promise<Gift> {
  return upload<Gift>(MallApi.Cover(id), file)
}
