import { describe, expect, it } from "vitest";
import type { AxiosError } from "axios";
import { extractMsg, unwrap } from "../../src/utils/request";

/** 构造最小 AxiosError 形状（extractMsg 只读 response.data 和 message） */
function fakeErr(data: unknown, message = "Network Error"): AxiosError {
  return { response: { data }, message } as unknown as AxiosError;
}

describe("unwrap 双后端兼容解包", () => {
  it("新后端 BaseResult：code=1 时取 data", () => {
    const body = { code: 1, msg: "成功", data: { token: "abc", admin: { role: "super_admin" } } };
    expect(unwrap<typeof body.data>(body)).toEqual({ token: "abc", admin: { role: "super_admin" } });
  });

  it("新后端 BaseResult + PageResult：转 Paged，page/pageSize 由请求参数回填", () => {
    const body = { code: 1, msg: "成功", data: { total: 2, rows: [{ id: 1 }, { id: 2 }] } };
    const res = unwrap<{ data: unknown[]; meta: { total: number; page: number; pageSize: number } }>(body, {
      page: 2,
      pageSize: 10,
    });
    expect(res.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(res.meta).toEqual({ total: 2, page: 2, pageSize: 10 });
  });

  it("新后端 PageResult 无请求参数时 meta 回填默认 1/50", () => {
    const body = { code: 1, msg: "成功", data: { total: 0, rows: [] } };
    const res = unwrap<{ meta: { total: number; page: number; pageSize: number } }>(body);
    expect(res.meta).toEqual({ total: 0, page: 1, pageSize: 50 });
  });

  it("新后端 BaseResult data 为裸数组（如礼品列表文档文字口径）：原样返回数组", () => {
    const body = { code: 1, msg: "成功", data: [{ id: 1, name: "京东购物卡" }] };
    const res = unwrap<{ id: number; name: string }[]>(body);
    expect(Array.isArray(res)).toBe(true);
    expect(res).toEqual([{ id: 1, name: "京东购物卡" }]);
  });

  it("新后端 code=0：抛出 msg（兜 HTTP 200 + code=0 偏差）", () => {
    const body = { code: 0, msg: "礼品名称已存在（含已下架礼品）", data: null };
    expect(() => unwrap(body)).toThrow("礼品名称已存在（含已下架礼品）");
  });

  it("新后端 code=0 且 msg 为空：抛兜底文案", () => {
    expect(() => unwrap({ code: 0, msg: "", data: null })).toThrow("请求失败");
    expect(() => unwrap({ code: 0, msg: null, data: null })).toThrow("请求失败");
  });

  it("新后端 BaseResult data=null（如登出）：返回 null", () => {
    expect(unwrap({ code: 1, msg: "成功", data: null })).toBeNull();
  });

  it("旧 Node 分页 {data,meta}：原样返回（同引用）", () => {
    const body = { data: [], meta: { total: 0, page: 1, pageSize: 20 } };
    expect(unwrap(body)).toBe(body);
  });

  it("旧 Node 裸 {data}：解包 data", () => {
    expect(unwrap({ data: { a: 1 } })).toEqual({ a: 1 });
  });

  it("无包装对象 / 数组 / null：原样返回", () => {
    expect(unwrap({ ok: true })).toEqual({ ok: true });
    expect(unwrap([1, 2])).toEqual([1, 2]);
    expect(unwrap(null)).toBeNull();
  });
});

describe("extractMsg 错误文案提取", () => {
  it("新后端错误体读 msg", async () => {
    expect(await extractMsg(fakeErr({ code: 0, msg: "无权限执行该操作", data: null }))).toBe("无权限执行该操作");
  });

  it("旧 Node 错误体读 message", async () => {
    expect(await extractMsg(fakeErr({ message: "账号或密码错误" }))).toBe("账号或密码错误");
  });

  it("msg 与 message 并存时 msg 优先", async () => {
    expect(await extractMsg(fakeErr({ msg: "前者优先", message: "后者兜底" }))).toBe("前者优先");
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
