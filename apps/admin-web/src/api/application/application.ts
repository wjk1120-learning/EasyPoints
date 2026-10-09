import type { Paged } from "../types"
import type { Application, ApplicationQuery, ApplicationReviewPayload } from "./types"
import { get, post } from "../../utils/request"
import { withMock } from "../../mock"
import { mockApplicationsPaged, mockReviewApplication } from "../../mock/application"

/** 积分申请 REST 路径（后端待开发，契约见 docs/admin-web-api-requirements.md 3.3） */
export const ApplicationApi = {
  List: "/admin/applications",
  Review: (id: number | string) => `/admin/applications/${id}/review`,
} as const

export type { Application, ApplicationQuery, ApplicationReviewPayload } from "./types"

/** 分页积分申请列表（当前 mock 先行，后端就绪后自动切换真实接口） */
export function applicationsPaged(params: ApplicationQuery): Promise<Paged<Application>> {
  return withMock(
    () => get<Paged<Application>>(ApplicationApi.List, { ...params }),
    () => mockApplicationsPaged(params),
  )
}

/** 审核积分申请：通过后双积分到账（后端职责），驳回意见必填 */
export function reviewApplication(id: number | string, payload: ApplicationReviewPayload): Promise<unknown> {
  return withMock(
    () => post<unknown>(ApplicationApi.Review(id), payload),
    () => mockReviewApplication(id, payload),
  )
}
