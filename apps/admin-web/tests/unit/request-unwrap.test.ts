import { describe, expect, it } from "vitest";
import type { AxiosError } from "axios";
import { extractMsg, unwrap } from "../../src/utils/request";

/** 构造最小 AxiosError 形状（extractMsg 只读 response.data 和 message） */
function fakeErr(data: unknown, message = "Network Error"): AxiosError {
  return { response: { data }, message } as unknown as AxiosError;
}

describe("unwrap 新后端统一解包", () => {
  it("BaseResult：code=1 时取 data", () => {
    const body = { code: 1, msg: "成功", data: { token: "abc", admin: { role: "super_admin" } } };
    expect(unwrap<typeof body.data>(body)).toEqual({ token: "abc", admin: { role: "super_admin" } });
  });

  it("BaseResult + PageResult：转 Paged，page/pageSize 由请求参数回填", () => {
    const body = { code: 1, msg: "成功", data: { total: 2, rows: [{ id: 1 }, { id: 2 }] } };
    const res = unwrap<{ data: unknown[]; meta: { total: number; page: number; pageSize: number } }>(body, {
      page: 2,
      pageSize: 10,
    });
    expect(res.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(res.meta).toEqual({ total: 2, page: 2, pageSize: 10 });
  });

  it("PageResult 无请求参数时 meta 回填默认 1/50", () => {
    const body = { code: 1, msg: "成功", data: { total: 0, rows: [] } };
    const res = unwrap<{ meta: { total: number; page: number; pageSize: number } }>(body);
    expect(res.meta).toEqual({ total: 0, page: 1, pageSize: 50 });
  });

  it("BaseResult data 为裸数组（如投票/申请等列表型 data）：原样返回数组", () => {
    const body = { code: 1, msg: "成功", data: [{ id: 1, name: "京东购物卡" }] };
    const res = unwrap<{ id: number; name: string }[]>(body);
    expect(Array.isArray(res)).toBe(true);
    expect(res).toEqual([{ id: 1, name: "京东购物卡" }]);
  });

  it("code=0：抛出 msg（兜 HTTP 200 + code=0 偏差）", () => {
    const body = { code: 0, msg: "礼品名称已存在（含已下架礼品）", data: null };
    expect(() => unwrap(body)).toThrow("礼品名称已存在（含已下架礼品）");
  });

  it("code=0 且 msg 为空：抛兜底文案", () => {
    expect(() => unwrap({ code: 0, msg: "", data: null })).toThrow("请求失败");
    expect(() => unwrap({ code: 0, msg: null, data: null })).toThrow("请求失败");
  });

  it("BaseResult data=null（如登出）：返回 null", () => {
    expect(unwrap({ code: 1, msg: "成功", data: null })).toBeNull();
  });

  it("缺少 BaseResult 包装的响应：抛格式错误（终态只认新后端）", () => {
    expect(() => unwrap({ data: { a: 1 } })).toThrow("响应格式不合法");
    expect(() => unwrap({ ok: true })).toThrow("响应格式不合法");
    expect(() => unwrap(null)).toThrow("响应格式不合法");
  });
});

describe("extractMsg 错误文案提取", () => {
  it("读 BaseResult.msg", async () => {
    expect(await extractMsg(fakeErr({ code: 0, msg: "无权限执行该操作", data: null }))).toBe("无权限执行该操作");
  });

  it("错误体无可读文案时落到 err.message", async () => {
    expect(await extractMsg(fakeErr({}, "timeout of 10000ms exceeded"))).toBe("timeout of 10000ms exceeded");
  });

  it("下载接口失败 body 为 Blob：解析内嵌 JSON 读 msg", async () => {
    const blob = new Blob([JSON.stringify({ code: 0, msg: "文件过大", data: null })], { type: "application/json" });
    expect(await extractMsg(fakeErr(blob))).toBe("文件过大");
  });

  it("Blob 非 JSON：落到 err.message", async () => {
    const blob = new Blob(["<html>Bad Gateway</html>"], { type: "text/html" });
    expect(await extractMsg(fakeErr(blob, "Request failed"))).toBe("Request failed");
  });
});
