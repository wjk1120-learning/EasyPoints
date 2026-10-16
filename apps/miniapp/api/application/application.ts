import type { Paged } from "../types"
import type { ApplicationCreatePayload, PointApplication } from "./types"
import { request, requestPaged } from "../../utils/request"

/** 积分申请 REST 路径（契约见 docs/Easy-Points-API.md 6.1~6.2） */
export const ApplicationApi = {
  List: "/miniapp/point-applications",
} as const

export type { ApplicationCreatePayload, PointApplication } from "./types"

/** 我的申请（6.2：PageResult 分页；待审状态值为 pending_review） */
export function fetchApplications(
  params: { page?: number; pageSize?: number } = {}
): Promise<Paged<PointApplication>> {
  return requestPaged<PointApplication>(ApplicationApi.List, params)
}

/** 提交申请（6.1：{ points, description }，幂等锁防双击；evidenceImages 佐证图 url ≤9 张，先过 11.9 上传接口） */
export function createApplication(
  payload: ApplicationCreatePayload & { evidenceImages?: string[] }
): Promise<PointApplication> {
  return request<PointApplication>(ApplicationApi.List, {
    method: "POST",
    data: { ...(payload.evidenceImages?.length ? { evidenceImages: payload.evidenceImages } : {}), ...payload }
  })
}
