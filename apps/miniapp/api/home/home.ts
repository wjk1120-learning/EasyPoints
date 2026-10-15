import type { HomeVo } from "./types"
import { request } from "../../utils/request"

/** 首页聚合 REST 路径（契约见 docs/Easy-Points-API.md 2.2） */
export const HomeApi = {
  Home: "/miniapp/home",
} as const

export type { HomeVo } from "./types"

/** 员工首页聚合：双积分 + 本月变动 + 未读数（recentRecords 后端只给 3 条，前端暂自取流水） */
export function fetchHome(): Promise<HomeVo> {
  return request<HomeVo>(HomeApi.Home)
}
