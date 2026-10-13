/**
 * 测试公共 HTTP 层：替换 axios 实例的 adapter 拦截请求（L2 契约测试用）。
 * 用法：beforeEach(() => resetHttp()) → setResponse(fixture) → 调真实域函数 → 断言 httpCalls。
 */
import { AxiosError } from "axios";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import request from "../../src/utils/request";

export type HttpCall = {
  method?: string;
  url?: string;
  params?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, unknown>;
};

export const httpCalls: HttpCall[] = [];
let respond: unknown = null;
let respondStatus = 200;

/** 设置下一次起所有请求的响应体与状态码 */
export function setResponse(data: unknown, status = 200): void {
  respond = data;
  respondStatus = status;
}

export function resetHttp(): void {
  httpCalls.length = 0;
  respond = null;
  respondStatus = 200;
  localStorage.setItem("token", "test-token");
  installAdapter();
}

function installAdapter(): void {
  const adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    let body: unknown = config.data;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        /* 非 JSON 原样保留 */
      }
    }
    httpCalls.push({ method: config.method, url: config.url, params: config.params, body, headers: config.headers });
    const response: AxiosResponse = { data: respond, status: respondStatus, statusText: "OK", headers: {}, config };
    // 模拟 axios 内置 adapter 的 settle 语义：非 2xx 抛 AxiosError（携带 response）
    if (respondStatus < 200 || respondStatus >= 300) {
      throw new AxiosError(`Request failed with status code ${respondStatus}`, AxiosError.ERR_BAD_RESPONSE, config, null, response);
    }
    return response;
  };
  request.defaults.adapter = adapter as AxiosAdapter;
}
