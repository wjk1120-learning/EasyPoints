import type { BadgesResult, DashboardSummary, LoginPayload, LoginResult } from "./types"
import { get, post } from "../../utils/request"

/** 认证与工作台聚合 REST 路径（契约见 docs/Easy-Points-API.md 1.1/11.2/11.3） */
export const AuthApi = {
  Login: "/admin/auth/login",
  /** 待办角标聚合（11.2：四类待审合计键，辖内裁剪；旧「未读数+mark-seen」语义已废弃） */
  Badges: "/admin/badges",
  /** 工作台汇总（11.3：员工/礼品/任务计数 + 四类待审） */
  DashboardSummary: "/admin/dashboard/summary",
} as const

export type { BadgesResult, DashboardSummary, LoginPayload, LoginResult } from "./types"

/** 管理员登录：成功返回 JWT 与管理员信息 */
export function login(payload: LoginPayload): Promise<LoginResult> {
  return post<LoginResult>(AuthApi.Login, payload)
}

/** 待办角标聚合（11.2）：一次请求返回四类待审数量 */
export function badges(): Promise<BadgesResult> {
  return get<BadgesResult>(AuthApi.Badges)
}

/** 工作台汇总（11.3）：一次请求返回计数看板与四类待审 */
export function dashboardSummary(): Promise<DashboardSummary> {
  return get<DashboardSummary>(AuthApi.DashboardSummary)
}
