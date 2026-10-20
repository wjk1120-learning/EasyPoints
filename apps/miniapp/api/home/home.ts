import type { HomeVo } from "./types"
import type { WithOfflineFlag } from "../../utils/request"
import { request } from "../../utils/request"

/** 首页聚合 REST 路径（契约见 docs/Easy-Points-API.md 2.2） */
export const HomeApi = {
  Home: "/miniapp/home",
} as const

export type { HomeVo } from "./types"

/** 员工首页聚合：双积分 + 本月变动 + 未读数 + 最近 3 条流水（recentRecords，前端不再自拉流水） */
export function fetchHome(): Promise<WithOfflineFlag<HomeVo>> {
  return request<WithOfflineFlag<HomeVo>>(HomeApi.Home)
}
