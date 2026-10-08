import type { Gift, GiftPayload } from "./types"
import { get, post, put, upload } from "../../utils/request"

/** 礼品商城 REST 路径（apps/api/src/app.js） */
export const MallApi = {
  Gifts: "/admin/mall/gifts",
  Gift: (id: number | string) => `/admin/mall/gifts/${id}`,
  Publish: (id: number | string) => `/admin/mall/gifts/${id}/publish`,
  Unpublish: (id: number | string) => `/admin/mall/gifts/${id}/unpublish`,
  Cover: (id: number | string) => `/admin/mall/gifts/${id}/cover`,
} as const

/** 全量礼品列表（下架礼品后台可见可管理，用户端隐藏） */
export function mallGifts(): Promise<Gift[]> {
  return get<Gift[]>(MallApi.Gifts)
}

export function createGift(payload: GiftPayload): Promise<Gift> {
  return post<Gift>(MallApi.Gifts, payload)
}

export function updateGift(id: number | string, payload: GiftPayload): Promise<Gift> {
  return put<Gift>(MallApi.Gift(id), payload)
}

export function publishGift(id: number | string): Promise<unknown> {
  return post<unknown>(MallApi.Publish(id))
}

export function unpublishGift(id: number | string): Promise<unknown> {
  return post<unknown>(MallApi.Unpublish(id))
}

/** 上传礼品封面（先保存礼品拿到 id；上限 5MB） */
export function uploadGiftCover(id: number | string, file: File): Promise<Gift> {
  return upload<Gift>(MallApi.Cover(id), file)
}
