import type { EmployeeLoginVo, LoginPayload } from "./types"
import { createNetworkError, getApiBase } from "../../utils/request"

/** 员工端登录 REST 路径（契约见 docs/Easy-Points-API.md 1.4~1.6） */
export const AuthApi = {
  Login: "/miniapp/auth/login",
} as const

export type { EmployeeLoginVo, LoginPayload } from "./types"

let loginPromise: Promise<EmployeeLoginVo> | null = null

/** 整段免登流程单飞锁：授权跳转/code 换令牌进行中时，后续调用等待同一流程，防止回调页首批请求重复触发授权跳转 */
let loginFlowPromise: Promise<void> | null = null

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

/** 企微 OAuth 网页授权配置：.env 构建注入为默认值，storage 可覆盖（同 apiBase 约定，免重建切换） */
function wecomOAuthConfig(): { corpid: string; agentid: string } {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env || {}
  return {
    corpid: String(uni.getStorageSync("wecomCorpid") || env.VITE_WECOM_CORPID || "").trim(),
    agentid: String(uni.getStorageSync("wecomAgentid") || env.VITE_WECOM_AGENTID || "").trim()
  }
}

/** 是否在企微内置浏览器中（UA 含 wxwork）；普通浏览器/本地联调为 false */
function isWecomBrowser(): boolean {
  return typeof navigator !== "undefined" && /wxwork/i.test(navigator.userAgent || "")
}

/** 读企微 OAuth 回调附带的 code（redirect_uri 上的 ?code=，位于 hash 前） */
function readOAuthCodeFromUrl(): string {
  // #ifdef H5
  try {
    return new URLSearchParams(window.location.search).get("code") || ""
  } catch {
    return ""
  }
  // #endif
  return ""
}

/** 构造企微 OAuth 静默授权跳转（snsapi_base 免确认；redirect_uri=站点根，回调后 code 落在 search 上） */
export function buildOAuthUrl(corpid: string, agentid: string, redirectUri: string): string {
  const query = [
    `appid=${encodeURIComponent(corpid)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    "response_type=code",
    "scope=snsapi_base",
    "state=easypoints",
    `agentid=${encodeURIComponent(agentid)}`
  ].join("&")
  return `https://open.weixin.qq.com/connect/oauth2/authorize?${query}#wechat_redirect`
}

function clearOAuthCodeFromUrl(): void {
  // #ifdef H5
  try {
    const { origin, pathname, hash } = window.location
    window.history.replaceState(null, "", `${origin}${pathname}${hash}`)
  } catch { }
  // #endif
}

/**
 * 登录编排（第 4 步：企微自建应用内 H5 免登，整段单飞）：
 * 1. 有 token 直接复用；
 * 2. URL 带企微 OAuth 回调 code → 生产登录（契约 1.4，后端 code2user/getuserinfo）；
 * 3. 企微内置浏览器（wxwork UA）且配置了 VITE_WECOM_CORPID/VITE_WECOM_AGENTID → 跳 OAuth 静默授权；
 * 4. 其余（本地浏览器联调、未配置）→ dev 直登（默认 zhangsan，调试面板可覆盖）。
 * App 启动与 request 内核 401 重登统一走这里。授权跳转/code 换令牌进行中时，并发调用
 * 等待同一流程而不是再跳一次授权（修测试机首进反复跳 open.weixin.qq.com 的竞态）。
 */
export async function ensureEmployeeLogin(): Promise<void> {
  if (uni.getStorageSync("employeeToken")) return
  if (!loginFlowPromise) {
    loginFlowPromise = runLoginFlow().finally(() => {
      loginFlowPromise = null
    })
  }
  return loginFlowPromise
}

/** 实际免登流程，仅由 ensureEmployeeLogin 启动（单飞）；失败时同一批等待方一起收到错误 */
async function runLoginFlow(): Promise<void> {
  // #ifdef H5
  const oauthCode = readOAuthCodeFromUrl()
  if (oauthCode) {
    clearOAuthCodeFromUrl()
    await loginEmployee({ code: oauthCode })
    return
  }
  const { corpid, agentid } = wecomOAuthConfig()
  if (corpid && agentid && isWecomBrowser()) {
    // 跳转已发起=授权进行中：流程保持挂起不落锁，导航窗口期内的后续调用等同一流程，不再二次跳授权
    window.location.replace(buildOAuthUrl(corpid, agentid, `${window.location.origin}/h5/`))
    return new Promise<void>(() => {})
  }
  // #endif
  await loginEmployee()
}

/** 仅供单测清理单飞锁（跳转分支流程永不落定，模块级锁会跨用例残留） */
export function __resetLoginFlowForTest(): void {
  loginFlowPromise = null
}
