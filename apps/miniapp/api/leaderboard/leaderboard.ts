import type { LeaderboardEntry } from "./types"
import { request } from "../../utils/request"

/** 排行榜 REST 路径（契约见 docs/Easy-Points-API.md 2.5：dimension=realtime 可用榜 / cumulative 累计榜） */
export const LeaderboardApi = {
  List: "/miniapp/leaderboard",
} as const

export type { LeaderboardEntry } from "./types"

/** 排行榜（现状 wire 参数为 rankBy 老口径——第 3 阶段切 dimension=realtime/cumulative） */
export function fetchLeaderboard(rankBy: string): Promise<LeaderboardEntry[]> {
  return request<LeaderboardEntry[]>(`${LeaderboardApi.List}?rankBy=${encodeURIComponent(rankBy)}`)
}
