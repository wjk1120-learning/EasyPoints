import { beforeEach, describe, expect, it } from "vitest";
import { applicationsPaged, reviewApplication } from "../../src/api/application/application";
import { httpCalls, resetHttp, setResponse } from "../helpers/http";
import { APPLICATIONS_FIXTURE } from "../fixtures/application";
import { baseResult } from "../fixtures/rule";

/** L2 契约测试：积分申请域（docs/Easy-Points-API.md 6.3/6.4） */

beforeEach(() => {
  resetHttp();
});

describe("契约：申请列表（文档 6.3）", () => {
  it("分页查询：筛选清洗后透传，行字段与文档示例一致（reason/evidenceImages[]/statusText/reviewedBy）", async () => {
    setResponse(baseResult({ total: APPLICATIONS_FIXTURE.length, rows: [...APPLICATIONS_FIXTURE] }));

    const res = await applicationsPaged({ page: 1, pageSize: 20, status: "pending_review", employeeId: "" });

    expect(httpCalls[0].method).toBe("get");
    expect(httpCalls[0].url).toBe("/admin/applications");
    expect(httpCalls[0].params).toEqual({ page: 1, pageSize: 20, status: "pending_review" });

    expect(res.meta.total).toBe(2);
    expect(res.data[0]).toMatchObject({
      id: 31,
      employeeName: "张三",
      points: 50,
      reason: "完成跨部门支持",
      evidenceImages: ["/uploads/ev/2.png"],
      statusText: "待审核",
    });
    expect(res.data[1]).toMatchObject({ status: "rejected", reviewRemark: "佐证不足", reviewedBy: "系统管理员" });
  });

  it("createdAfter 时间筛选透传", async () => {
    setResponse(baseResult({ total: 0, rows: [] }));
    await applicationsPaged({ page: 1, pageSize: 20, createdAfter: "2026-10-01 00:00:00" });
    expect(httpCalls[0].params).toEqual({ page: 1, pageSize: 20, createdAfter: "2026-10-01 00:00:00" });
  });
});

describe("契约：申请审核（文档 6.4）", () => {
  it("通过：POST /admin/applications/{id}/review 请求体 {status:'approved', remark}", async () => {
    setResponse(baseResult({ ...APPLICATIONS_FIXTURE[0], status: "approved" }));

    await reviewApplication(31, { status: "approved", remark: "审核通过" });

    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/applications/31/review");
    expect(httpCalls[0].body).toEqual({ status: "approved", remark: "审核通过" });
  });

  it("驳回备注为空：HTTP 400 + msg 透传（文档 6.4 错误场景）", async () => {
    setResponse({ code: 0, msg: "处理备注不能为空", data: null }, 400);
    await expect(reviewApplication(31, { status: "rejected", remark: "" })).rejects.toThrow("处理备注不能为空");
  });

  it("重复审核：HTTP 400 状态文案透传", async () => {
    setResponse({ code: 0, msg: "该申请当前状态不可审核", data: null }, 400);
    await expect(reviewApplication(31, { status: "approved", remark: "x" })).rejects.toThrow("该申请当前状态不可审核");
  });
});
