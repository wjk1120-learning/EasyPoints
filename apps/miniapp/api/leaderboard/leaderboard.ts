import type { LeaderboardDimension, LeaderboardEntry } from "./types"
import { request } from "../../utils/request"

/** 排行榜 REST 路径（契约见 docs/Easy-Points-API.md 2.5：dimension=realtime 可用榜 / cumulative 累计榜） */
export const LeaderboardApi = {
  List: "/miniapp/leaderboard",
} as const

export type { LeaderboardDimension, LeaderboardEntry } from "./types"

/** 排行榜（2.5：全量降序、过滤离职；两榜行均附 availablePoints/actualPoints，数组返回无分页） */
export function fetchLeaderboard(dimension: LeaderboardDimension): Promise<LeaderboardEntry[]> {
  return request<LeaderboardEntry[]>(`${LeaderboardApi.List}?dimension=${dimension}`)
}
