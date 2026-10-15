import type { VoteDetail, VoteSummary } from "./types"
import { request } from "../../utils/request"

/** 投票 REST 路径（契约见 docs/Easy-Points-API.md 9.7~9.9；ballots 为小程序契约路由） */
export const VoteApi = {
  List: "/miniapp/votes",
  Vote: (id: number | string) => `/miniapp/votes/${encodeURIComponent(String(id))}`,
  Ballots: (id: number | string) => `/miniapp/votes/${encodeURIComponent(String(id))}/ballots`,
} as const

export type { VoteDetail, VoteSummary } from "./types"

/** 我的投票（9.7：scope=pending 待参与 / history 已提交或已结束；现状按数组解析——第 3 阶段切 PageResult） */
export function fetchVotes(scope: "pending" | "history"): Promise<VoteSummary[]> {
  return request<VoteSummary[]>(`${VoteApi.List}?scope=${scope}`)
}

/** 投票详情（9.8：非参与者 404 投票不存在；options[].text 与 selectedOptionIds 为小程序契约字段名） */
export function fetchVote(id: number | string): Promise<VoteDetail> {
  return request<VoteDetail>(VoteApi.Vote(id))
}

/** 提交投票（9.9：{ optionIds }，单选恰 1 项；返回提交后详情含 selectedOptionIds 回显；每人限投 1 次） */
export function submitBallot(id: number | string, optionIds: (number | string)[]): Promise<VoteDetail> {
  return request<VoteDetail>(VoteApi.Ballots(id), { method: "POST", data: { optionIds } })
}
