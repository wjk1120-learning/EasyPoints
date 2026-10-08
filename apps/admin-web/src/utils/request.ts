import axios from "axios";
import type { AxiosError, AxiosRequestConfig } from "axios";

/** 请求前缀：开发环境留空走 vite 代理（/admin、/uploads → localhost:3000），生产由 VITE_API_BASE 指定 */
export const API_BASE = import.meta.env.VITE_API_BASE || "";

export const DEFAULT_TIMEOUT_MS = 10_000;

/** 匿名接口白名单：无需令牌即可发起（当前仅管理端登录） */
const ANON_URLS = ["/admin/auth/login"];

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

/** 后端错误体形如 { message: "..." }；提取可读文案，网络层失败给固定兜底 */
function extractMsg(err: AxiosError): string {
  const data = err.response?.data as { message?: unknown } | undefined;
  if (data && typeof data.message === "string" && data.message.trim()) return data.message.trim();
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
    return config; // 与旧 authFetch 行为一致：过期后不带令牌继续发，由 401 统一处理
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (!ANON_URLS.some((u) => (config.url ?? "").includes(u))) {
    // 开发环境无 token 时保留 x-admin-id 冒充头（联调后端 mock 鉴权依赖）
    if (!import.meta.env.PROD) {
      config.headers["x-admin-id"] = localStorage.getItem("adminId") || "1";
    }
  }
  return config;
});

request.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      clearAuth("unauthorized");
      return Promise.reject(new Error("登录已失效，请重新登录"));
    }
    return Promise.reject(new Error(extractMsg(err)));
  },
);

/** 与旧 request() 解包规则一致：带 meta 的分页响应原样返回，其余取 body.data ?? body */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === "object" && "meta" in (body as Record<string, unknown>)) {
    return body as T;
  }
  const data = (body as { data?: unknown } | null)?.data;
  return (data === undefined ? body : data) as T;
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
  return request
    .get(url, { ...config, ...(cleanParams(params) ? { params: cleanParams(params) } : undefined) })
    .then((res) => unwrap<T>(res.data));
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
