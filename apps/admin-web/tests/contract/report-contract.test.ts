import { beforeEach, describe, expect, it } from "vitest";
import { exportPointRecordsXlsx, exportPointsSummaryXlsx, reportsPaged } from "../../src/api/report/report";
import { exportOrdersXlsx } from "../../src/api/order/order";
import { exportTaskRecordsXlsx } from "../../src/api/task/task";
import { httpCalls, resetHttp, setResponse } from "../helpers/http";
import { POINT_REPORT_ROW_FIXTURE } from "../fixtures/points";
import { baseResult } from "../fixtures/rule";

/** L2 契约测试：报表与导出域（docs/Easy-Points-API.md 3.4/3.5/11.5/11.7/11.8） */

const XLSX = new Blob(["fake-xlsx"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

beforeEach(() => {
  resetHttp();
  setResponse(XLSX);
});

describe("契约：积分流水分页（文档 3.4）", () => {
  it("GET /admin/reports/point-records：PageResult 转 Paged", async () => {
    setResponse(baseResult({ total: 1, rows: [POINT_REPORT_ROW_FIXTURE] }));
    const res = await reportsPaged({ page: 1, pageSize: 20 });
    expect(httpCalls[0].url).toBe("/admin/reports/point-records");
    expect(res.meta.total).toBe(1);
    expect(res.data[0].employeeName).toBe("张三");
  });
});

describe("契约：导出 xlsx（下载类接口返回二进制流，不走 BaseResult）", () => {
  it("个人积分明细导出（3.5）：employeeId 必填，选月份时携带", async () => {
    const blob = await exportPointRecordsXlsx({ employeeId: 1, month: "2026-10" });

    expect(httpCalls[0].method).toBe("get");
    expect(httpCalls[0].url).toBe("/admin/reports/point-records.xlsx");
    expect(httpCalls[0].params).toEqual({ employeeId: 1, month: "2026-10" });
    expect(blob).toBeInstanceOf(Blob);
  });

  it("个人积分明细导出（3.5 前端口径 2026-10-13）：不选月份时不带 month 参数（导出全部流水，待后端契约同步）", async () => {
    await exportPointRecordsXlsx({ employeeId: 1, month: undefined });
    expect(httpCalls[0].params).toEqual({ employeeId: 1 });
  });

  it("全员积分汇总导出（11.5）：GET points-summary.xlsx 无参数", async () => {
    await exportPointsSummaryXlsx();
    expect(httpCalls[0].url).toBe("/admin/reports/points-summary.xlsx");
    expect(httpCalls[0].params).toBeUndefined();
  });

  it("兑换记录表导出（11.7）：GET orders.xlsx 筛选清洗后透传", async () => {
    await exportOrdersXlsx({ employeeId: "", status: "approved" }); // 空 employeeId 应被过滤
    expect(httpCalls[0].url).toBe("/admin/orders.xlsx");
    expect(httpCalls[0].params).toEqual({ status: "approved" });
  });

  it("任务审核记录表导出（11.8）：GET task-records.xlsx", async () => {
    await exportTaskRecordsXlsx({ status: "pending_review" });
    expect(httpCalls[0].url).toBe("/admin/task-records.xlsx");
    expect(httpCalls[0].params).toEqual({ status: "pending_review" });
  });
});
