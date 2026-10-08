import type { BadgesResult, LoginPayload, LoginResult } from "./types"
import { get, post } from "../../utils/request"

/** 认证与角标 REST 路径（apps/api/src/app.js） */
export const AuthApi = {
  Login: "/admin/auth/login",
  Badges: "/admin/badges",
  BadgesMarkSeen: "/admin/badges/mark-seen",
} as const

/** 管理员登录：成功返回 JWT 与管理员信息 */
export function login(payload: LoginPayload): Promise<LoginResult> {
  return post<LoginResult>(AuthApi.Login, payload)
}

/** 顶栏待办角标：申诉/订单未处理数 */
export function badges(): Promise<BadgesResult> {
  return get<BadgesResult>(AuthApi.Badges)
}

/** 标记角标已读（keys 为已处理的工单标识） */
export function markBadgesSeen(keys: string[]): Promise<unknown> {
  return post<unknown>(AuthApi.BadgesMarkSeen, { keys: Array.isArray(keys) ? keys : [] })
}
