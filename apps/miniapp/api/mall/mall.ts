import type { Gift } from "./types"
import { request } from "../../utils/request"

/** 商城 REST 路径（契约见 docs/Easy-Points-API.md 4.7） */
export const MallApi = {
  Gifts: "/miniapp/mall/gifts",
} as const

export type { Gift } from "./types"

/** 上架礼品列表（4.7：仅 active；下架礼品服务端已过滤） */
export function fetchGifts(): Promise<Gift[]> {
  return request<Gift[]>(MallApi.Gifts)
}
