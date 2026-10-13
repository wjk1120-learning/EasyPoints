import { beforeEach, describe, expect, it } from "vitest";
import { appealsPaged, reviewAppeal } from "../../src/api/appeal/appeal";
import { httpCalls, resetHttp, setResponse } from "../helpers/http";
import { APPEALS_FIXTURE } from "../fixtures/appeal";
import { baseResult } from "../fixtures/rule";

/** L2 契约测试：申诉域（docs/Easy-Points-API.md 7.3/7.4 一级三态） */

beforeEach(() => {
  resetHttp();
});

describe("契约：申诉列表（文档 7.3）", () => {
  it("pending_review 三态查询透传，行含 targetSummary/statusText/evidenceImages(JSON 字符串)", async () => {
    setResponse(baseResult({ total: APPEALS_FIXTURE.length, rows: [...APPEALS_FIXTURE] }));

    const res = await appealsPaged({ page: 1, pageSize: 50, status: "pending_review", employeeId: "" });

    expect(httpCalls[0].method).toBe("get");
    expect(httpCalls[0].url).toBe("/admin/appeals");
    expect(httpCalls[0].params).toEqual({ page: 1, pageSize: 50, status: "pending_review" });

    expect(res.meta.total).toBe(2);
    expect(res.data[0]).toMatchObject({
      targetType: "point_record",
      pointRecordId: 101,
      status: "pending_review",
      statusText: "待审核",
    });
    expect(res.data[0].targetSummary).toEqual({ title: "积分流水 #101", content: "月度检查不合格扣分", reviewRemark: null });
    expect(res.data[0].evidenceImages).toBe('["/uploads/ev/a1.png"]'); // JSON 字符串原样
  });

  it("任务类申诉：无 pointRecord，targetSummary.title/content/reviewRemark 提供审核上下文", async () => {
    setResponse(baseResult({ total: 1, rows: [APPEALS_FIXTURE[1]] }));
    const res = await appealsPaged({ page: 1, pageSize: 50 });
    expect(res.data[0].pointRecord).toBeNull();
    expect(res.data[0].targetSummary).toMatchObject({ title: "整理客户回访文档", reviewRemark: "缺少回访记录明细，请补充后重新提交" });
  });
});

describe("契约：申诉审核（文档 7.4 一级三态，无 stage）", () => {
  it("通过：POST /admin/appeals/{id}/review 请求体仅 {status:'approved', resultRemark}", async () => {
    setResponse(baseResult(APPEALS_FIXTURE[0]));

    await reviewAppeal(21, { status: "approved", resultRemark: "申诉成立，予以补分" });

    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/appeals/21/review");
    expect(httpCalls[0].body).toEqual({ status: "approved", resultRemark: "申诉成立，予以补分" });
    expect(Object.keys(httpCalls[0].body as object)).not.toContain("stage"); // 一级审核无 stage
  });

  it("驳回：{status:'rejected', resultRemark}，后端 400 文案透传", async () => {
    setResponse({ code: 0, msg: "处理备注不能为空", data: null }, 400);
    await expect(reviewAppeal(21, { status: "rejected", resultRemark: "" })).rejects.toThrow("处理备注不能为空");

    setResponse({ code: 0, msg: "该申诉已处理完毕", data: null }, 400);
    await expect(reviewAppeal(20, { status: "approved", resultRemark: "x" })).rejects.toThrow("该申诉已处理完毕");
  });
});
