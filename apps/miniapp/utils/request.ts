/**
 * 请求层：uni.request 封装 + BaseResult 解包 + GET 离线缓存 + 网络错误识别。
 * 契约：docs/Easy-Points-API.md v4.3——统一 BaseResult{code:1|0, msg, data}；分页 PageResult{total,rows}；
 * 业务错误 msg 为中文可展示文案（原样透传给页面 toast）；时间统一 yyyy-MM-dd HH:mm:ss（东八区）。
 */
import { clearAuthError, clearEmployeeAuth, ensureEmployeeLogin, markNetworkError } from "../api/auth/auth";
import type { Paged } from "../api/types";

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/** 离线兜底标记：GET 网络失败回灌缓存时带上，页面据此显示离线提示 */
export type WithOfflineFlag<T> = T & { __offline?: boolean };

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** 请求载荷：传输层不关心形状，业务载荷类型由各域定义 */
  data?: object;
  header?: Record<string, string>;
};

type BaseResult = { code: number; msg?: string; data?: unknown } & Record<string, unknown>;

export type RawResponse = {
  statusCode: number;
  data: unknown;
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

/**
 * 静态资源（/uploads/** 等后端文件）拼前缀专用：必须产出带协议的完整 URL。
 * 原因：uni H5 的 image 组件对 / 开头路径会经 getRealPath/addBase 自动拼上
 * router base（如 /h5/），后端资源路径会被改写成不存在的 /h5/uploads/**；
 * 而带协议的地址（https://...）在 uni 内部原样放行，不受影响。
 */
export function getAssetBase(): string {
  const apiBase = getApiBase();
  if (apiBase) return apiBase;
  // #ifdef H5
  if (typeof window !== "undefined") return window.location.origin;
  // #endif
  return "";
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

/** 只认 BaseResult：code!==1 抛后端 msg 原文；缺包装视为响应不合法 */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === "object" && "code" in body && "msg" in body && "data" in body) {
    const r = body as BaseResult;
    if (r.code !== 1) throw new Error(typeof r.msg === "string" && r.msg.trim() ? r.msg.trim() : "请求失败");
    return (r.data ?? null) as T;
  }
  throw new Error("响应格式不合法（缺少 BaseResult 包装）");
}

/** PageResult{total,rows} → Paged{data,meta}（page/pageSize 从请求参数回填）；非分页形状视为不合法 */
function toPaged<T>(data: unknown, params: QueryParams): Paged<T> {
  if (data && typeof data === "object" && "total" in data && "rows" in data) {
    const r = data as { total?: number; rows?: unknown };
    return {
      data: (r.rows ?? []) as T[],
      meta: {
        total: Number(r.total ?? 0),
        page: Number(params.page ?? 1),
        pageSize: Number(params.pageSize ?? 50)
      }
    };
  }
  throw new Error("响应格式不合法（分页接口缺少 PageResult）");
}

/** 非 2xx：从 BaseResult body 提取 msg，无则给 HTTP 状态兜底文案 */
function httpError(response: RawResponse): Error {
  const body = response.data as BaseResult | undefined;
  const msg =
    body && typeof body === "object" && typeof body.msg === "string" && body.msg.trim()
      ? body.msg.trim()
      : `请求失败（HTTP ${response.statusCode}）`;
  return new Error(msg);
}

export function rawRequest(path: string, options: RequestOptions = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync("employeeToken") || "";
    const header = {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.header || {})
    };
    uni.request({
      url: `${getApiBase()}${path}`,
      method: options.method || "GET",
      data: options.data || {},
      header,
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

/** 登录编排接入：无 token 先等登录完成再发请求（修冷启动首请求必 401 的竞态）；401 则清登录态 → 重登 → 重试一次 */
async function authorizeAndFetch(path: string, options: RequestOptions): Promise<RawResponse> {
  if (!uni.getStorageSync("employeeToken")) {
    await ensureEmployeeLogin();
  }
  let response = await rawRequest(path, options);
  if (response.statusCode === 401) {
    clearEmployeeAuth("unauthorized");
    await ensureEmployeeLogin();
    response = await rawRequest(path, options);
  }
  return response;
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || "GET";
  try {
    const response = await authorizeAndFetch(path, options);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      const data = unwrap<T>(response.data);
      if (isGetMethod(method)) writeCache(path, data);
      clearAuthError();
      return data;
    }
    throw httpError(response);
  } catch (error) {
    const cached = tryReadCache(path, method);
    if (isNetworkError(error) && cached != null) {
      return { ...(cached as Record<string, unknown>), __offline: true } as T;
    }
    throw error;
  }
}

/**
 * 分页请求：query 由 params 组装（替代手拼查询串），PageResult 归一为 Paged。
 * 仅已适配的域函数使用；页面拿 { data: rows, meta: { total, page, pageSize } }。
 */
export async function requestPaged<T = unknown>(
  path: string,
  params: QueryParams = {},
  options: RequestOptions = {}
): Promise<Paged<T>> {
  const method = options.method || "GET";
  const fullPath = `${path}${toQuery(params)}`;
  try {
    const response = await authorizeAndFetch(fullPath, options);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      const result = toPaged<T>(unwrap(response.data), params);
      if (isGetMethod(method)) writeCache(fullPath, result);
      clearAuthError();
      return result;
    }
    throw httpError(response);
  } catch (error) {
    const cachedPaged = tryReadCache(fullPath, method) as Paged<T> | null;
    if (isNetworkError(error) && cachedPaged != null) {
      return { ...cachedPaged, __offline: true } as Paged<T>;
    }
    throw error;
  }
}

/** 接口不存在族识别（页面过渡期引导文案用；后端 v4.3 全接口在位，第 3 阶段随页面切换移除） */
export function isMissingApi(error: unknown): boolean {
  const msg = String((error as Error)?.message || "");
  return /接口不存在|404|未实现|501/.test(msg);
}

/** 查询参数序列化：跳过 null/undefined/空串 */
export function toQuery(params?: QueryParams): string {
  if (!params) return "";
  const pairs = Object.keys(params)
    .filter((key) => params[key] !== null && params[key] !== undefined && params[key] !== "")
    .map((key) => `${key}=${encodeURIComponent(String(params[key]))}`);
  return pairs.length ? `?${pairs.join("&")}` : "";
}
