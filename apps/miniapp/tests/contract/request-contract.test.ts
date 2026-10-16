import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUniStub } from "../helpers/uni-stub";
import { LOGIN_REJECTED, LOGIN_SUCCESS, POINT_RECORDS, SUBMIT_EMPTY_CONTENT, TASKS_PAGED } from "../fixtures/auth";
import { ensureEmployeeLogin, loginEmployee } from "../../api/auth/auth";
import { request, requestPaged } from "../../utils/request";

/** L2 契约：请求内核（BaseResult 解包 / PageResult 归一 / 401 重登重试 / msg 透传）。fixture=docs/Easy-Points-API.md v4.3 示例 */

let stub!: ReturnType<typeof createUniStub>;

describe("request：BaseResult 解包", () => {
  beforeEach(() => {
    stub = createUniStub();
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("code=1 返回 data 本体（积分流水按月分组示例）", async () => {
    stub.responders.push({ statusCode: 200, data: POINT_RECORDS });
    const data = await request<{ "2026-10": unknown[] }>("/miniapp/points/records");
    expect(data["2026-10"]).toHaveLength(1);
    expect((data["2026-10"][0] as { remark: string }).remark).toBe("任务奖励：月度之星评选");
  });

  it("code=0 抛后端 msg 原文（契约 5.2b：成果说明不能为空）", async () => {
    stub.responders.push({ statusCode: 400, data: SUBMIT_EMPTY_CONTENT });
    await expect(request("/miniapp/tasks/7/submit", { method: "POST", data: { content: "" } })).rejects.toThrow(
      "成果说明不能为空"
    );
  });

  it("缺 BaseResult 包装：抛「响应格式不合法」", async () => {
    stub.responders.push({ statusCode: 200, data: [{ id: 1 }] });
    await expect(request("/miniapp/some-list")).rejects.toThrow("响应格式不合法");
  });

  it("无 token 时不发 x-employee-id 冒充头；有 token 时带 Bearer", async () => {
    stub.responders.push({ statusCode: 200, data: POINT_RECORDS });
    await request("/miniapp/points/records");
    expect(stub.calls[0].options.header).not.toHaveProperty("x-employee-id");

    stub.storage.set("employeeToken", "tok-1");
    stub.responders.push({ statusCode: 200, data: POINT_RECORDS });
    await request("/miniapp/points/records");
    expect(stub.calls[1].options.header?.authorization).toBe("Bearer tok-1");
  });
});

describe("request：401 自动重登并重试一次", () => {
  beforeEach(() => {
    stub = createUniStub();
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("401 → 登录拿新 token → 原请求重试带新 Bearer → 返回数据", async () => {
    stub.storage.set("wecomUserId", "zhangsan");
    stub.responders.push({ statusCode: 401, data: { code: 0, msg: "登录已过期", data: null } });
    stub.responders.push({ statusCode: 200, data: LOGIN_SUCCESS });
    stub.responders.push({ statusCode: 200, data: POINT_RECORDS });

    const data = await request<{ "2026-10": unknown[] }>("/miniapp/points/records");

    expect(stub.calls).toHaveLength(3);
    expect(stub.calls[1].options.url).toContain("/miniapp/auth/login");
    expect(stub.calls[2].options.header?.authorization).toBe("Bearer emp-token-1");
    expect(stub.storage.get("employeeToken")).toBe("emp-token-1");
    expect(data["2026-10"]).toHaveLength(1);
  });

  it("重登也失败：抛登录失败 msg（员工不存在）", async () => {
    stub.responders.push({ statusCode: 401, data: { code: 0, msg: "登录已过期", data: null } });
    stub.responders.push({ statusCode: 401, data: LOGIN_REJECTED });

    await expect(request("/miniapp/points/records")).rejects.toThrow("员工不存在");
    expect(stub.calls).toHaveLength(2);
  });
});

describe("requestPaged：PageResult 归一", () => {
  beforeEach(() => {
    stub = createUniStub();
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("PageResult{total,rows} → Paged{data,meta}，page/pageSize 从参数回填", async () => {
    stub.storage.set("employeeToken", "tok-1");
    stub.responders.push({ statusCode: 200, data: TASKS_PAGED });

    const page = await requestPaged<{ id: number }>("/miniapp/tasks", { scope: "all", page: 2, pageSize: 10 });

    expect(stub.calls[0].options.url).toBe("/miniapp/tasks?scope=all&page=2&pageSize=10");
    expect(page.data).toHaveLength(2);
    expect(page.data[0].id).toBe(7);
    expect(page.meta).toEqual({ total: 2, page: 2, pageSize: 10 });
  });

  it("非分页形状（data 缺 total/rows）：抛「响应格式不合法」", async () => {
    stub.storage.set("employeeToken", "tok-1");
    stub.responders.push({ statusCode: 200, data: { code: 1, msg: "成功", data: [1, 2] } });

    await expect(requestPaged("/miniapp/tasks", { scope: "all" })).rejects.toThrow("响应格式不合法");
  });
});

describe("loginEmployee：契约 1.4", () => {
  beforeEach(() => {
    stub = createUniStub();
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("成功：存 accessToken/refreshToken/employeeId，返回 EmployeeLoginVo", async () => {
    stub.responders.push({ statusCode: 200, data: LOGIN_SUCCESS });

    const vo = await loginEmployee({ wecomUserId: "BoLaiDeJingCai" });

    expect(vo.accessToken).toBe("emp-token-1");
    expect(stub.storage.get("employeeToken")).toBe("emp-token-1");
    expect(stub.storage.get("employeeRefreshToken")).toBe("refresh-1");
    expect(stub.storage.get("employeeId")).toBe("3");
  });

  it("失败（401 员工不存在）：抛 msg 原文并清登录态", async () => {
    stub.storage.set("employeeToken", "stale-token");
    stub.responders.push({ statusCode: 401, data: LOGIN_REJECTED });

    await expect(loginEmployee({ wecomUserId: "nobody" })).rejects.toThrow("员工不存在");
    expect(stub.storage.has("employeeToken")).toBe(false);
  });

  it("免登 code 优先：带 code 时只传 code（生产模式契约）", async () => {
    stub.responders.push({ statusCode: 200, data: LOGIN_SUCCESS });

    await loginEmployee({ code: "wecom-code-1" });

    expect(stub.calls[0].options.data).toEqual({ code: "wecom-code-1" });
  });
});

describe("ensureEmployeeLogin：企微自建应用 H5 免登（第 4 步）", () => {
  /** happy-dom 的 history.pushState 不生效，用官方 setURL 控制 URL */
  function setTestUrl(url: string) {
    (window as unknown as { happyDOM?: { setURL: (u: string) => void } }).happyDOM?.setURL(url);
  }

  /** vi.stubEnv 不影响其他模块的 import.meta.env，改用 storage 覆盖（wecomOAuthConfig 的 storage 优先约定） */
  function stubOAuthEnv(corpid: string, agentid: string) {
    stub.storage.set("wecomCorpid", corpid);
    stub.storage.set("wecomAgentid", agentid);
  }

  beforeEach(() => {
    stub = createUniStub();
    setTestUrl("https://app.example.com/");
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("已有 token：直接复用，不登录也不跳授权", async () => {
    stub.storage.set("employeeToken", "tok-keep");
    const replaceSpy = vi.spyOn(window.location, "replace").mockImplementation(() => {});

    await ensureEmployeeLogin();

    expect(stub.calls).toHaveLength(0);
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("URL 带企微 OAuth 回调 code：走生产登录（URL 清理走 replaceState，happy-dom 不模拟故不在此断言）", async () => {
    setTestUrl("https://app.example.com/?code=h5-code-7&state=easypoints");
    stub.responders.push({ statusCode: 200, data: LOGIN_SUCCESS });

    await ensureEmployeeLogin();

    expect(stub.calls[0].options.url).toContain("/miniapp/auth/login");
    expect(stub.calls[0].options.data).toEqual({ code: "h5-code-7" });
    expect(stub.storage.get("employeeToken")).toBe("emp-token-1");
  });

  it("企微内置浏览器 + 已配置 corpid/agentid：跳 OAuth 静默授权（不发登录请求）", async () => {
    stubOAuthEnv("wwcorp123", "1000002");
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android) wxwork/4.1" });
    const replaceSpy = vi.spyOn(window.location, "replace").mockImplementation(() => {});

    await ensureEmployeeLogin();

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    const url = String(replaceSpy.mock.calls[0][0]);
    expect(url).toContain("open.weixin.qq.com/connect/oauth2/authorize");
    expect(url).toContain("appid=wwcorp123");
    expect(url).toContain("agentid=1000002");
    expect(url).toContain("scope=snsapi_base");
    expect(stub.calls).toHaveLength(0);
  });

  it("普通浏览器（本地联调）：即使配置存在也回退 dev 直登", async () => {
    stubOAuthEnv("wwcorp123", "1000002");
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Chrome/126" });
    stub.storage.set("wecomUserId", "zhangsan");
    stub.responders.push({ statusCode: 200, data: LOGIN_SUCCESS });

    await ensureEmployeeLogin();

    expect(stub.calls[0].options.data).toEqual({ wecomUserId: "zhangsan", employeeId: "" });
    expect(stub.storage.get("employeeToken")).toBe("emp-token-1");
  });
});
