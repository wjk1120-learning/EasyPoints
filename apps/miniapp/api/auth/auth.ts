import type { LoginPayload, LoginResult } from "./types"
import { createNetworkError, getApiBase } from "../../utils/request"

/** 员工端登录 REST 路径（契约见 docs/Easy-Points-API.md 1.4~1.6） */
export const AuthApi = {
  Login: "/miniapp/auth/login",
} as const

export type { LoginPayload, LoginResult } from "./types"

let loginPromise: Promise<LoginResult> | null = null

export function clearEmployeeAuth(reason?: string): void {
  uni.removeStorageSync("employeeToken")
  if (reason) uni.setStorageSync("employeeAuthError", String(reason))
}

export function markNetworkError(): void {
  uni.setStorageSync("employeeAuthError", "network_error")
}

export function clearAuthError(): void {
  uni.removeStorageSync("employeeAuthError")
}

/** 员工登录（dev 直登 wecomUserId，缺省 zhangsan；401 时 request 层自动重登重试一次） */
export function loginEmployee(payload: LoginPayload = {}): Promise<LoginResult> {
  if (loginPromise) return loginPromise
  const wecomUserId = String(payload.wecomUserId || uni.getStorageSync("wecomUserId") || "zhangsan").trim()
  const employeeId = payload.employeeId || ""
  const hadToken = Boolean(uni.getStorageSync("employeeToken"))
  if (!hadToken) uni.removeStorageSync("employeeToken")
  loginPromise = new Promise((resolve, reject) => {
    uni.request({
      url: `${getApiBase()}${AuthApi.Login}`,
      method: "POST",
      header: { "content-type": "application/json" },
      data: { wecomUserId, employeeId },
      success(res) {
        const body = res.data as LoginResult & { message?: string }
        if (res.statusCode >= 200 && res.statusCode < 300 && body?.token) {
          uni.setStorageSync("employeeToken", body.token)
          if (body?.employee?.id) uni.setStorageSync("employeeId", String(body.employee.id))
          if (wecomUserId) uni.setStorageSync("wecomUserId", wecomUserId)
          clearAuthError()
          resolve(body)
        } else {
          clearEmployeeAuth("unauthorized")
          reject(new Error(body?.message || "登录失败"))
        }
      },
      fail(err) {
        markNetworkError()
        reject(createNetworkError(err))
      },
      complete() {
        loginPromise = null
      }
    })
  })
  return loginPromise
}
