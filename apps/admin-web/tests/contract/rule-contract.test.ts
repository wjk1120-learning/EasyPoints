import { beforeEach, describe, expect, it } from "vitest";
import { getRule, saveRule } from "../../src/api/rule/rule";
import { httpCalls, resetHttp, setResponse } from "../helpers/http";
import { RULE_EMPTY_FIXTURE, RULE_FIXTURE, baseResult } from "../fixtures/rule";

/** L2 契约测试：规则配置域（docs/Easy-Points-API.md 8.1 / 8.2） */

beforeEach(() => {
  resetHttp();
});

describe("契约：获取当前生效规则（文档 8.1）", () => {
  it("GET /admin/rules 无查询参数，BaseResult 解包出 RuleContent", async () => {
    setResponse(baseResult(RULE_FIXTURE));

    const rule = await getRule();

    expect(httpCalls[0].method).toBe("get");
    expect(httpCalls[0].url).toBe("/admin/rules");
    expect(httpCalls[0].params).toBeUndefined();

    expect(rule.content).toBe(RULE_FIXTURE.content);
    expect(rule.updatedAt).toBe("2026-10-12 16:30:00");
    expect(rule.updatedBy).toBe("系统管理员");
  });

  it("无规则时 content 为空串（文档 8.1：不报错、空串占位）", async () => {
    setResponse(baseResult(RULE_EMPTY_FIXTURE));
    const rule = await getRule();
    expect(rule.content).toBe("");
  });
});

describe("契约：保存规则（文档 8.2）", () => {
  it("PUT /admin/rules 请求体仅 {content}，响应解包为保存后的 RuleContent", async () => {
    const saved = { ...RULE_FIXTURE, content: "<p>新规则内容</p>", updatedAt: "2026-10-13 10:00:00", updatedBy: "系统管理员" };
    setResponse(baseResult(saved));

    const result = await saveRule({ content: "<p>新规则内容</p>" });

    expect(httpCalls[0].method).toBe("put");
    expect(httpCalls[0].url).toBe("/admin/rules");
    expect(httpCalls[0].body).toEqual({ content: "<p>新规则内容</p>" });

    expect(result.content).toBe("<p>新规则内容</p>");
    expect(result.updatedAt).toBe("2026-10-13 10:00:00");
  });

  it("空内容：HTTP 400 + msg 透传（文档 8.2 错误场景）", async () => {
    setResponse({ code: 0, msg: "规则内容不能为空", data: null }, 400);
    await expect(saveRule({ content: "" })).rejects.toThrow("规则内容不能为空");
    expect(httpCalls[0].body).toEqual({ content: "" });
  });
});
