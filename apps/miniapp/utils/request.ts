/**
 * 请求层：uni.request 封装 + GET 离线缓存 + 网络错误识别。
 * 契约现状（老口径，第 2 步统一切新后端）：响应信封 { data: ... }，分页 { data, meta }，错误字段 message。
 */
import { clearAuthError, clearEmployeeAuth, loginEmployee, markNetworkError } from "../api/auth/auth";
import type { Paged } from "../api/types";

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** 请求载荷：传输层不关心形状，业务载荷类型由各域定义 */
  data?: object;
  header?: Record<string, string>;
};

export type RawResponse = {
  statusCode: number;
  data: { data?: unknown; meta?: unknown; message?: string } & Record<string, unknown>;
};

function normalizeApiBase(value: unknown): string {
  if (value === false || value === true || value == null) return "";
  const raw = String(value || "").trim();
  if (!raw || raw === "false" || raw === "true") return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function isValidApiBase(value: string): boolean {
  return /^https?:\/\/.+/i.test(value);
}

export function getApiBase(): string {
  const stored = normalizeApiBase(uni.getStorageSync("apiBase"));
  if (isValidApiBase(stored)) return stored;
  // #ifdef H5
  // H5 默认同源（空串），走 vite 代理转发到后端，避免跨域
  return "";
  // #endif
  // #ifndef H5
  // 小程序请求不受 CORS 限制，使用绝对地址（微信开发者工具需勾选「不校验合法域名」）
  return "http://localhost:3000";
  // #endif
}

function cacheStorageKey(path: string): string {
  return `cache:${path}`;
}

function readCache(path: string): unknown {
  try {
    const raw = uni.getStorageSync(cacheStorageKey(path));
    if (!raw) return null;
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    return (parsed as { data?: unknown } | null)?.data ?? null;
  } catch {
    return null;
  }
}

export function getCachedData(path: string): unknown {
  return readCache(path);
}

function writeCache(path: string, data: unknown): void {
  try {
    uni.setStorageSync(cacheStorageKey(path), JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {}
}

export function createNetworkError(err: unknown): Error {
  const e = err as { errMsg?: string; message?: string } | null;
  const error = new Error(e?.errMsg || e?.message || "网络不可用，请检查连接");
  (error as Error & { isNetworkError?: boolean }).isNetworkError = true;
  return error;
}

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  if ((error as Error & { isNetworkError?: boolean }).isNetworkError) return true;
  const msg = String((error as Error)?.message || (error as { errMsg?: string })?.errMsg || "");
  return /network|网络|timeout|超时|fail|connect|request:fail/i.test(msg);
}

function isGetMethod(method: string): boolean {
  return String(method || "GET").toUpperCase() === "GET";
}

export function rawRequest(path: string, options: RequestOptions = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync("employeeToken") || "";
    const authHeader = token
      ? { authorization: `Bearer ${token}` }
      : { "x-employee-id": uni.getStorageSync("employeeId") || "1" };
    uni.request({
      url: `${getApiBase()}${path}`,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        ...authHeader,
        ...(options.header || {})
      },
      success(response) {
        resolve(response as unknown as RawResponse);
      },
      fail(err) {
        markNetworkError();
        reject(createNetworkError(err));
      }
    });
  });
}

function tryReadCache(path: string, method: string): unknown {
  if (!isGetMethod(method)) return null;
  return readCache(path);
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || "GET";
  try {
    const response = await rawRequest(path, options);
    if (response.statusCode === 401) {
      clearEmployeeAuth("unauthorized");
      await loginEmployee();
      const retry = await rawRequest(path, options);
      if (retry.statusCode >= 200 && retry.statusCode < 300) {
        const data = retry.data.data;
        if (isGetMethod(method)) writeCache(path, data);
        clearAuthError();
        return data as T;
      }
      throw new Error(retry.data?.message || "请求失败");
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      const data = response.data.data;
      if (isGetMethod(method)) writeCache(path, data);
      clearAuthError();
      return data as T;
    }
    throw new Error(response.data?.message || "请求失败");
  } catch (error) {
    const cached = tryReadCache(path, method);
    if (isNetworkError(error) && cached != null) {
      return { ...(cached as Record<string, unknown>), __offline: true } as T;
    }
    throw error;
  }
}

export async function requestPaged<T = unknown>(path: string, options: RequestOptions = {}): Promise<Paged<T>> {
  const method = options.method || "GET";
  try {
    const response = await rawRequest(path, options);
    if (response.statusCode === 401) {
      clearEmployeeAuth("unauthorized");
      await loginEmployee();
      const retry = await rawRequest(path, options);
      if (retry.statusCode >= 200 && retry.statusCode < 300) {
        const result = { data: retry.data.data as T, meta: retry.data.meta || null };
        if (isGetMethod(method)) writeCache(path, result);
        clearAuthError();
        return result;
      }
      throw new Error(retry.data?.message || "请求失败");
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      const result = { data: response.data.data as T, meta: response.data.meta || null };
      if (isGetMethod(method)) writeCache(path, result);
      clearAuthError();
      return result;
    }
    throw new Error(response.data?.message || "请求失败");
  } catch (error) {
    const cachedPaged = tryReadCache(path, method) as Paged<T> | null;
    if (isNetworkError(error) && cachedPaged != null) {
      return { ...cachedPaged, __offline: true } as Paged<T>;
    }
    throw error;
  }
}

/** 接口不存在族识别（页面用于展示「约定接口」引导文案） */
export function isMissingApi(error: unknown): boolean {
  const msg = String((error as Error)?.message || "");
  return /接口不存在|404|未实现|501/.test(msg);
}

/** 查询参数序列化：跳过 null/undefined/空串 */
export function toQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const pairs = Object.keys(params)
    .filter((key) => params[key] !== null && params[key] !== undefined && params[key] !== "")
    .map((key) => `${key}=${encodeURIComponent(String(params[key]))}`);
  return pairs.length ? `?${pairs.join("&")}` : "";
}
