import type { Paged } from "../types"
import type { Vote, VotePayload, VoteQuery, VoteStats } from "./types"
import { download, get, post } from "../../utils/request"

/** 投票管理 REST 路径（契约见 docs/Easy-Points-API.md 9.1~9.6；投票不触碰积分台账） */
export const VoteApi = {
  List: "/admin/votes",
  Vote: (id: number | string) => `/admin/votes/${id}`,
  Close: (id: number | string) => `/admin/votes/${id}/close`,
  Stats: (id: number | string) => `/admin/votes/${id}/stats`,
  StatsXlsx: (id: number | string) => `/admin/votes/${id}/stats.xlsx`,
} as const

export type { Vote, VotePayload, VoteQuery, VoteStats } from "./types"

/** 分页投票列表（9.1：创建倒序；支持标题模糊与派生状态筛选） */
export function votesPaged(params: VoteQuery = {}): Promise<Paged<Vote>> {
  return get<Paged<Vote>>(VoteApi.List, { ...params })
}

/**
 * 新建投票（9.2：options 传纯字符串数组，ID 服务端生成；到开始时间自动推送参与员工通知）。
 * 契约缺口：前端携带 description（选填补充说明），文档 9.2 payload 表未列，已记入后端反馈。
 */
export function createVote(payload: VotePayload): Promise<Vote> {
  return post<Vote>(VoteApi.List, payload)
}

/** 编辑投票（9.3：仅未开始可编辑，voteType 不可改；选项整体重建） */
export function updateVote(id: number | string, payload: VotePayload): Promise<Vote> {
  return post<Vote>(VoteApi.Vote(id) + "/update", payload)
}

/** 手动关闭投票（9.4：关闭后员工不可提交；已结束后端 400「投票已结束，无需关闭」） */
export function closeVote(id: number | string): Promise<unknown> {
  return post<unknown>(VoteApi.Close(id))
}

/** 投票统计（9.5：进行中/已结束可查；未开始后端 400「投票未开始」） */
export function voteStats(id: number | string): Promise<VoteStats> {
  return get<VoteStats>(VoteApi.Stats(id))
}

/** 导出投票统计 Excel（9.6：双 Sheet 定稿——统计含合计与最高票选项行 + 参与明细；文件名由前端拼接） */
export function exportVoteStatsXlsx(id: number | string): Promise<Blob> {
  return download(VoteApi.StatsXlsx(id))
}
