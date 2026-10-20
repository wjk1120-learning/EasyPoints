import type { Paged } from "../types"
import type { Application, ApplicationQuery, ApplicationReviewPayload } from "./types"
import { get, post } from "../../utils/request"

/** 积分申请 REST 路径（契约见 docs/Easy-Points-API.md 6.3/6.4） */
export const ApplicationApi = {
  List: "/admin/applications",
  Review: (id: number | string) => `/admin/applications/${id}/review`,
} as const

export type { Application, ApplicationQuery, ApplicationReviewPayload } from "./types"

/** 分页申请列表（6.3：待审核置顶；支持状态/员工/提交时间筛选） */
export function applicationsPaged(params: ApplicationQuery): Promise<Paged<Application>> {
  return get<Paged<Application>>(ApplicationApi.List, { ...params })
}

/** 审核积分申请（6.4：通过后 type=application 流水双积分入账；驳回后员工可申诉） */
export function reviewApplication(id: number | string, payload: ApplicationReviewPayload): Promise<unknown> {
  return post<unknown>(ApplicationApi.Review(id), payload)
}
