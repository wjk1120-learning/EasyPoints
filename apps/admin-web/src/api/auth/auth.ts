import type { LoginPayload, LoginResult } from "./types"
import { post } from "../../utils/request"

/** 认证 REST 路径（apps/api/src/app.js；待办角标改为前端四类查询拼装，见 docs/admin-web-api-requirements.md 3.1） */
export const AuthApi = {
  Login: "/admin/auth/login",
} as const

/** 管理员登录：成功返回 JWT 与管理员信息 */
export function login(payload: LoginPayload): Promise<LoginResult> {
  return post<LoginResult>(AuthApi.Login, payload)
}
