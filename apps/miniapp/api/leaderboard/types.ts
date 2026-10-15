/** leaderboard 域类型：积分排行榜（契约见 docs/Easy-Points-API.md 2.5，全量降序、过滤离职） */

export interface LeaderboardEntry {
  id: number | string
  rank?: number
  name?: string
  departmentName?: string
  pointsBalance?: number
  /** 可用积分（v4.2 两榜行均附） */
  availablePoints?: number
  /** 累计积分（v4.2 两榜行均附） */
  actualPoints?: number
}
