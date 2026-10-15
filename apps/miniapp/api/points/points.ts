import type { MonthGroups } from "./types"
import { request, toQuery } from "../../utils/request"

/** 积分流水 REST 路径（契约见 docs/Easy-Points-API.md 2.1） */
export const PointsApi = {
  Records: "/miniapp/points/records",
} as const

export type { MonthGroups, PointRecordItem } from "./types"

/** 我的积分明细（按月分组；month=yyyy-MM 可选，category=increase/decrease/manual 可选） */
export function fetchPointRecords(params?: { month?: string; category?: string }): Promise<MonthGroups> {
  return request<MonthGroups>(`${PointsApi.Records}${toQuery(params)}`)
}
