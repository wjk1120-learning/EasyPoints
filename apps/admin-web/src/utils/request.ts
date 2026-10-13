import axios from "axios";
import type { AxiosError, AxiosRequestConfig } from "axios";

/** 请求前缀：开发环境留空走 vite 代理（/admin、/uploads → 后端），生产由 VITE_API_BASE 指定 */
export const API_BASE = import.meta.env.VITE_API_BASE || "";

export const DEFAULT_TIMEOUT_MS = 10_000;

export type RequestConfig = AxiosRequestConfig;

function parseJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return false;
  return Date.now() >= Number(payload.exp) * 1000;
}

/** 清理登录态并广播事件：App.vue 监听 auth:logout 弹提示并回到登录页 */
export function clearAuth(reason: "expired" | "unauthorized"): void {
  localStorage.removeItem("token");
  localStorage.removeItem("adminId");
  localStorage.removeItem("admin");
  window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason } }));
}

/** 错误文案提取（导出仅供 tests 断言）：统一读 BaseResult.msg；下载接口失败时 body 是 Blob，尝试解析内嵌 JSON */
export async function extractMsg(err: AxiosError): Promise<string> {
  let data = err.response?.data as { msg?: unknown } | Blob | undefined;
  if (data instanceof Blob) {
    try {
      data = JSON.parse(await data.text()) as { msg?: unknown };
    } catch {
      data = undefined;
    }
  }
  const raw = data?.msg;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return err.message || "网络请求失败，请检查服务是否可达";
}

const request = axios.create({
  baseURL: API_BASE,
  timeout: DEFAULT_TIMEOUT_MS,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || "";
  if (token && isJwtExpired(token)) {
    clearAuth("expired");
    return config; // 过期后不带令牌继续发，由 401 统一处理
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      clearAuth("unauthorized");
      return Promise.reject(new Error("登录已失效，请重新登录"));
    }
    return Promise.reject(new Error(await extractMsg(err)));
  },
);

/** 新后端分页 PageResult{total,rows} 转成前端 Paged{data,meta}，page/pageSize 由请求参数回填；非该结构返回 null */
function pageOf<T>(
  payload: unknown,
  params?: Record<string, unknown>,
): { data: T[]; meta: { total: number; page: number; pageSize: number } } | null {
  if (!payload || typeof payload !== "object") return null;
  if (!("rows" in payload) || !("total" in payload)) return null;
  const p = payload as { total: unknown; rows: unknown };
  if (!Array.isArray(p.rows)) return null;
  return {
    data: p.rows as T[],
    meta: {
      total: Number(p.total) || 0,
      page: Number(params?.page) || 1,
      pageSize: Number(params?.pageSize) || 50,
    },
  };
}

/**
 * 新后端统一解包（导出仅供 tests 断言）：BaseResult{code,msg,data}——
 * code!==1 时抛出 msg（兜住 HTTP 200 + code=0 的实现偏差）；
 * data 为 PageResult{total,rows} 时转 Paged，其余（对象/数组/null）直接返回。
 */
export function unwrap<T>(body: unknown, params?: Record<string, unknown>): T {
  if (body && typeof body === "object" && "code" in body && "msg" in body && "data" in body) {
    const r = body as { code: unknown; msg: unknown; data: unknown };
    if (r.code !== 1) {
      throw new Error(typeof r.msg === "string" && r.msg.trim() ? r.msg.trim() : "请求失败");
    }
    return (pageOf<T>(r.data, params) ?? r.data) as T;
  }
  throw new Error("响应格式不合法（缺少 BaseResult 包装）");
}

/** 过滤空参数（undefined/null/""），与旧 buildQuery 行为一致 */
function cleanParams(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
}

export function get<T>(url: string, params?: Record<string, unknown>, config?: RequestConfig): Promise<T> {
  const cleaned = cleanParams(params);
  return request
    .get(url, cleaned ? { ...config, params: cleaned } : config)
    .then((res) => unwrap<T>(res.data, cleaned));
}

export function post<T>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
  return request.post(url, body, config).then((res) => unwrap<T>(res.data));
}

export function put<T>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
  return request.put(url, body, config).then((res) => unwrap<T>(res.data));
}

export function del<T>(url: string, config?: RequestConfig): Promise<T> {
  return request.delete(url, config).then((res) => unwrap<T>(res.data));
}

/** GET 下载二进制（Excel 导出等），返回 Blob 供调用方保存 */
export async function download(url: string, params?: Record<string, unknown>): Promise<Blob> {
  const res = await request.get(url, {
    params: cleanParams(params),
    responseType: "blob",
  });
  return res.data as Blob;
}

/** multipart 文件上传（礼品封面、佐证图片等） */
export async function upload<T>(url: string, file: File): Promise<T> {
  const data = new FormData();
  data.append("file", file);
  const res = await request.post(url, data, {
    headers: { "content-type": "multipart/form-data" },
  });
  return unwrap<T>(res.data);
}

/** 触发浏览器保存 Blob 到本地文件（导出文件名带时间戳由调用方拼） */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default request;
