import { beforeEach, describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import request, { get, post } from "../../src/utils/request";

/**
 * L2 契约测试：fixture 全部取自 docs/Easy-Points-API.md v4.2 的响应示例。
 * 通过替换 axios adapter 拦截 HTTP 层，双向断言：
 *  ① 前端发出的 URL/方法/查询参数/请求体与文档契约一致；
 *  ② 文档示例响应经 unwrap 解包后恰为页面所需形状。
 */

type Call = { method?: string; url?: string; params?: Record<string, unknown>; body?: unknown; headers?: Record<string, unknown> };

const calls: Call[] = [];
let respond: unknown = null;
let respondStatus = 200;

function useAdapter(): void {
  const adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    let body: unknown = config.data;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        /* 非 JSON 原样保留 */
      }
    }
    calls.push({ method: config.method, url: config.url, params: config.params, body, headers: config.headers });
    const response: AxiosResponse = { data: respond, status: respondStatus, statusText: "OK", headers: {}, config };
    // 模拟 axios 内置 adapter 的 settle 语义：非 2xx 抛 AxiosError（携带 response）
    if (respondStatus < 200 || respondStatus >= 300) {
      throw new AxiosError(`Request failed with status code ${respondStatus}`, AxiosError.ERR_BAD_RESPONSE, config, null, response);
    }
    return response;
  };
  request.defaults.adapter = adapter as AxiosAdapter;
}

beforeEach(() => {
  calls.length = 0;
  respond = null;
  respondStatus = 200;
  localStorage.setItem("token", "test-token");
  useAdapter();
});

describe("契约：管理端登录（文档 1.1 示例）", () => {
  it("POST /admin/auth/login 请求体 {username,password}，响应解包出 token 与 AdminBrief", async () => {
    respond = {
      code: 1,
      msg: "成功",
      data: {
        token: "eyJhbGciOiJIUzI1NiJ9...",
        accessToken: "eyJhbGciOiJIUzI1NiJ9...",
        refreshToken: "QVs0YmxzZ2hQ...",
        tokenType: "Bearer",
        expiresIn: 43200,
        admin: { id: 1, username: "admin", name: "系统管理员", role: "super_admin", departmentIds: [] },
      },
    };

    type LoginVo = { token: string; admin: { id: number; role: string; departmentIds: number[] } };
    const res = await post<LoginVo>("/admin/auth/login", { username: "admin", password: "admin123" });

    expect(calls[0].method).toBe("post");
    expect(calls[0].url).toBe("/admin/auth/login");
    expect(calls[0].body).toEqual({ username: "admin", password: "admin123" });

    expect(res.token).toBe("eyJhbGciOiJIUzI1NiJ9...");
    expect(res.admin.role).toBe("super_admin");
    expect(res.admin.departmentIds).toEqual([]);
  });
});

describe("契约：订单分页（文档 4.10/6.3 PageResult 示例形态）", () => {
  it("GET /admin/orders 查询参数清洗后透传，PageResult 转为 Paged", async () => {
    respond = {
      code: 1,
      msg: "成功",
      data: {
        total: 1,
        rows: [
          {
            id: 5001,
            employeeId: 1,
            employeeName: "张三",
            giftId: 1,
            giftName: "京东购物卡 100 元",
            pointsCost: 1000,
            status: "pending_review",
            remark: null,
            createdAt: "2026-10-10 09:00:00",
            updatedAt: "2026-10-10 09:00:00",
          },
        ],
      },
    };

    type OrderRow = { id: number; employeeName: string; giftName: string; status: string };
    const res = await get<{ data: OrderRow[]; meta: { total: number } }>("/admin/orders", {
      page: 1,
      pageSize: 20,
      status: "pending_review",
      employeeId: undefined, // 应被 cleanParams 过滤
    });

    expect(calls[0].method).toBe("get");
    expect(calls[0].url).toBe("/admin/orders");
    expect(calls[0].params).toEqual({ page: 1, pageSize: 20, status: "pending_review" });

    expect(res.meta.total).toBe(1);
    expect(res.data[0]).toMatchObject({ id: 5001, employeeName: "张三", giftName: "京东购物卡 100 元", status: "pending_review" });
  });
});

describe("契约：礼品列表（文档 4.1，2026-10-13 定稿 PageResult 包装；裸数组分支保留为防御兼容）", () => {
  it("主契约：PageResult 包装（4.1 响应示例）→ 转 Paged", async () => {
    respond = {
      code: 1,
      msg: "成功",
      data: {
        total: 2,
        rows: [
          { id: 1, name: "京东购物卡 100 元", pointsCost: 1000, stock: 20, status: "active", limitPerUser: 2, coverImageUrl: "/uploads/gifts/1/cover-a1b2.png" },
        ],
      },
    };
    const res = await get<{ data: unknown[]; meta: { total: number } }>("/admin/mall/gifts");
    expect(res.meta.total).toBe(2);
    expect(res.data[0]).toMatchObject({ id: 1, name: "京东购物卡 100 元", stock: 20 });
  });

  it("防御兼容：裸数组（后端实现偏差时）→ 原样返回", async () => {
    respond = {
      code: 1,
      msg: "成功",
      data: [{ id: 1, name: "京东购物卡 100 元", pointsCost: 1000, stock: 20, status: "active" }],
    };
    const res = await get<{ id: number; name: string }[]>("/admin/mall/gifts");
    expect(Array.isArray(res)).toBe(true);
    expect(res[0]).toMatchObject({ id: 1, name: "京东购物卡 100 元" });
  });
});

describe("契约：鉴权与错误链路", () => {
  it("HTTP 200 + code=0：get() 以 msg reject", async () => {
    respond = { code: 0, msg: "无权操作该资源", data: null };
    await expect(get("/admin/mall/gifts")).rejects.toThrow("无权操作该资源");
  });

  it("HTTP 400 错误体 BaseResult：reject 出 msg 文案", async () => {
    respond = { code: 0, msg: "处理备注不能为空", data: null };
    respondStatus = 400;
    await expect(post("/admin/orders/5001/status", { status: "rejected" })).rejects.toThrow("处理备注不能为空");
  });

  it("HTTP 401：清登录态并 reject 固定文案", async () => {
    respond = { code: 0, msg: "未登录", data: null };
    respondStatus = 401;
    await expect(get("/admin/orders")).rejects.toThrow("登录已失效，请重新登录");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("请求头携带 Bearer token", async () => {
    await get("/admin/orders");
    expect((calls[0].headers?.Authorization as string) || "").toBe("Bearer test-token");
  });
});
