import { beforeEach, describe, expect, it } from "vitest";
import { adjustment, monthlyBatch, reversePointRecord } from "../../src/api/points/points";
import { reportsPaged } from "../../src/api/report/report";
import { httpCalls, resetHttp, setResponse } from "../helpers/http";
import { POINT_RECORD_FIXTURE, POINT_REPORT_ROW_FIXTURE } from "../fixtures/points";
import { baseResult } from "../fixtures/rule";

/** L2 契约测试：积分录入域（docs/Easy-Points-API.md 3.1~3.4） */

beforeEach(() => {
  resetHttp();
});

describe("契约：单笔奖惩（文档 3.1）", () => {
  it("POST /admin/points/adjustment 请求体 {employeeId,type,pointsDelta,remark}，返回入账流水", async () => {
    setResponse(baseResult(POINT_RECORD_FIXTURE));

    const record = await adjustment({ employeeId: 1, type: "reward", pointsDelta: 50, remark: "客户表扬" });

    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/points/adjustment");
    expect(httpCalls[0].body).toEqual({ employeeId: 1, type: "reward", pointsDelta: 50, remark: "客户表扬" });

    expect(record).toMatchObject({ id: 101, pointsDelta: 50, cumulativePointsDelta: 50, type: "performance" });
  });

  it("备注为空：HTTP 400 + 后端文案透传（文档 3.1 错误场景）", async () => {
    setResponse({ code: 0, msg: "单笔奖惩积分必须填写变动原因备注", data: null }, 400);
    await expect(adjustment({ employeeId: 1, type: "reward", pointsDelta: 50, remark: "" })).rejects.toThrow(
      "单笔奖惩积分必须填写变动原因备注",
    );
  });
});

describe("契约：月度批量录分（文档 3.2）", () => {
  it("POST /admin/points/monthly-batch 请求体 {month,batchRemark,items[]}，返回流水数组", async () => {
    setResponse(baseResult([POINT_RECORD_FIXTURE]));

    const records = await monthlyBatch({
      month: "2026-10",
      batchRemark: "10月绩效",
      items: [{ employeeId: 1, pointsDelta: 50 }],
    });

    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/points/monthly-batch");
    expect(httpCalls[0].body).toEqual({ month: "2026-10", batchRemark: "10月绩效", items: [{ employeeId: 1, pointsDelta: 50 }] });
    expect(records).toHaveLength(1);
    expect(records[0].remark).toBe("任务奖励：月度之星评选");
  });

  it("单人备注覆盖统一备注（items[].remark 透传）", async () => {
    setResponse(baseResult([POINT_RECORD_FIXTURE]));
    await monthlyBatch({ month: "2026-10", batchRemark: "统一备注", items: [{ employeeId: 2, pointsDelta: -10, remark: "迟到扣分" }] });
    expect(httpCalls[0].body).toEqual({
      month: "2026-10",
      batchRemark: "统一备注",
      items: [{ employeeId: 2, pointsDelta: -10, remark: "迟到扣分" }],
    });
  });
});

describe("契约：冲正（文档 3.3）", () => {
  it("POST /admin/points/{id}/reverse 请求体仅 {remark}，返回反向流水", async () => {
    setResponse(baseResult({ ...POINT_RECORD_FIXTURE, id: 102, pointsDelta: -50, reversalOfId: 101, type: "reversal" }));

    const record = await reversePointRecord(101, "录入错误，冲正");

    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/points/101/reverse");
    expect(httpCalls[0].body).toEqual({ remark: "录入错误，冲正" });

    expect(record.reversalOfId).toBe(101);
    expect(record.type).toBe("reversal");
  });

  it("重复冲正：HTTP 400 + msg 透传（文档 3.3 错误场景）", async () => {
    setResponse({ code: 0, msg: "该积分流水已被冲正，不能重复冲正", data: null }, 400);
    await expect(reversePointRecord(101, "再次冲正")).rejects.toThrow("该积分流水已被冲正，不能重复冲正");
  });
});

describe("契约：积分流水分页（文档 3.4）", () => {
  it("GET /admin/reports/point-records：month/employeeId 透传，行含 employeeName 与双积分变动", async () => {
    setResponse(baseResult({ total: 1, rows: [POINT_REPORT_ROW_FIXTURE] }));

    const res = await reportsPaged({ month: "2026-10", employeeId: 1, page: 1, pageSize: 20 });

    expect(httpCalls[0].method).toBe("get");
    expect(httpCalls[0].url).toBe("/admin/reports/point-records");
    expect(httpCalls[0].params).toEqual({ month: "2026-10", employeeId: 1, page: 1, pageSize: 20 });

    expect(res.meta.total).toBe(1);
    expect(res.data[0]).toMatchObject({ employeeName: "张三", pointsDelta: 50, cumulativePointsDelta: 50, remark: "任务奖励：月度之星评选" });
  });
});
