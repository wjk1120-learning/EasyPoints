import type { EmployeeLoginVo, LoginPayload } from "./types"
import { createNetworkError, getApiBase } from "../../utils/request"

/** 员工端登录 REST 路径（契约见 docs/Easy-Points-API.md 1.4~1.6） */
export const AuthApi = {
  Login: "/miniapp/auth/login",
} as const

export type { EmployeeLoginVo, LoginPayload } from "./types"

let loginPromise: Promise<EmployeeLoginVo> | null = null

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

/**
 * 员工登录（契约 1.4）：dev 直登 wecomUserId（缺省 zhangsan），生产仅企微免登 code（第 4 步接入）。
 * 401 时 request 层自动重登重试一次；登录失败 msg（如「员工不存在」）原样抛给页面。
 */
export function loginEmployee(payload: LoginPayload = {}): Promise<EmployeeLoginVo> {
  if (loginPromise) return loginPromise;
  const wecomUserId = String(payload.wecomUserId || uni.getStorageSync("wecomUserId") || "zhangsan").trim();
  const employeeId = payload.employeeId || "";
  const hadToken = Boolean(uni.getStorageSync("employeeToken"));
  if (!hadToken) uni.removeStorageSync("employeeToken");
  loginPromise = new Promise((resolve, reject) => {
    uni.request({
      url: `${getApiBase()}${AuthApi.Login}`,
      method: "POST",
      header: { "content-type": "application/json" },
      data: payload.code ? { code: payload.code } : { wecomUserId, employeeId },
      success(res) {
        const body = res.data as { code?: number; msg?: string; data?: EmployeeLoginVo | null };
        const data = body?.data;
        if (res.statusCode >= 200 && res.statusCode < 300 && body?.code === 1 && data?.accessToken) {
          uni.setStorageSync("employeeToken", data.accessToken);
          if (data.refreshToken) uni.setStorageSync("employeeRefreshToken", data.refreshToken);
          if (data.employee?.id) uni.setStorageSync("employeeId", String(data.employee.id));
          if (wecomUserId) uni.setStorageSync("wecomUserId", wecomUserId);
          clearAuthError();
          resolve(data);
        } else {
          clearEmployeeAuth("unauthorized");
          reject(new Error(body?.msg || "登录失败"));
        }
      },
      fail(err) {
        markNetworkError();
        reject(createNetworkError(err));
      },
      complete() {
        loginPromise = null;
      }
    });
  });
  return loginPromise;
}
