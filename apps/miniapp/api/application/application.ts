import type { ApplicationCreatePayload, PointApplication } from "./types"
import { request } from "../../utils/request"

/** 积分申请 REST 路径（契约见 docs/Easy-Points-API.md 6.1~6.2） */
export const ApplicationApi = {
  List: "/miniapp/point-applications",
} as const

export type { ApplicationCreatePayload, PointApplication } from "./types"

/** 我的申请（6.2：现状按数组解析——第 3 阶段切 PageResult） */
export function fetchApplications(): Promise<PointApplication[]> {
  return request<PointApplication[]>(ApplicationApi.List)
}

/** 提交申请（6.1：{ points, description }，幂等锁防双击；审核通过双积分入账） */
export function createApplication(payload: ApplicationCreatePayload): Promise<PointApplication> {
  return request<PointApplication>(ApplicationApi.List, { method: "POST", data: payload })
}
