import type { Paged } from "../types"
import type { Vote, VotePayload, VoteQuery, VoteStats } from "./types"
import { get, post } from "../../utils/request"
import { withMock } from "../../mock"
import { mockCloseVote, mockCreateVote, mockUpdateVote, mockVoteStats, mockVotesPaged } from "../../mock/vote"

/** 投票管理 REST 路径（后端待开发，契约见 docs/admin-web-api-requirements.md 3.7） */
export const VoteApi = {
  List: "/admin/votes",
  Vote: (id: number | string) => `/admin/votes/${id}`,
  Close: (id: number | string) => `/admin/votes/${id}/close`,
  Stats: (id: number | string) => `/admin/votes/${id}/stats`,
  StatsXlsx: (id: number | string) => `/admin/votes/${id}/stats.xlsx`,
} as const

export type { Vote, VotePayload, VoteQuery, VoteStats } from "./types"

/** 分页投票列表（创建时间倒序；支持标题模糊与状态筛选） */
export function votesPaged(params: VoteQuery = {}): Promise<Paged<Vote>> {
  return withMock(
    () => get<Paged<Vote>>(VoteApi.List, { ...params }),
    () => mockVotesPaged(params),
  )
}

/** 新建投票：保存后到开始时间自动推送参与员工通知（通知推送为后端职责） */
export function createVote(payload: VotePayload): Promise<Vote> {
  return withMock(
    () => post<Vote>(VoteApi.List, payload),
    () => mockCreateVote(payload),
  )
}

/** 编辑投票：仅未开始允许，开始后不可修改题目/选项/参与人 */
export function updateVote(id: number | string, payload: VotePayload): Promise<Vote> {
  return withMock(
    () => post<Vote>(VoteApi.Vote(id) + "/update", payload),
    () => mockUpdateVote(id, payload),
  )
}

/** 手动关闭投票：关闭后员工不可提交 */
export function closeVote(id: number | string): Promise<unknown> {
  return withMock(
    () => post<unknown>(VoteApi.Close(id)),
    () => mockCloseVote(id),
  )
}

/** 投票统计（进行中/已结束可看；未开始后端拒绝） */
export function voteStats(id: number | string): Promise<VoteStats> {
  return withMock(
    () => get<VoteStats>(VoteApi.Stats(id)),
    () => mockVoteStats(id),
  )
}
