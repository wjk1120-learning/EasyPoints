/** leaderboard 域类型：积分排行榜（契约见 docs/Easy-Points-API.md 2.5，全量降序、过滤离职） */

export type LeaderboardDimension = "realtime" | "cumulative"

export interface LeaderboardEntry {
  id: number | string
  rank?: number
  name?: string
  departmentName?: string
  /** 当前榜维度的分数 */
  points?: number
  /** 实际积分（两榜同源随行带出） */
  availablePoints?: number
  /** 累计积分（小程序契约字段，两榜同源） */
  actualPoints?: number
  dimension?: string
}
