import { beforeEach, describe, expect, it } from "vitest";
import { employees } from "../../src/api/employee/employee";
import { httpCalls, resetHttp, setResponse } from "../helpers/http";
import { EMPLOYEES_FIXTURE } from "../fixtures/employee";
import { baseResult } from "../fixtures/rule";

/** L2 契约测试：员工列表域（docs/Easy-Points-API.md 11.1，2026-10-13 定稿恒 PageResult 包装） */

beforeEach(() => {
  resetHttp();
});

describe("契约：员工列表（文档 11.1）", () => {
  it("无参 GET /admin/employees：PageResult 包装解包为数组，双积分字段直通", async () => {
    setResponse(baseResult({ total: EMPLOYEES_FIXTURE.length, rows: [...EMPLOYEES_FIXTURE] }));

    const list = await employees();

    expect(httpCalls[0].method).toBe("get");
    expect(httpCalls[0].url).toBe("/admin/employees");
    expect(httpCalls[0].params).toBeUndefined(); // 无参全量，不带分页

    expect(list).toHaveLength(EMPLOYEES_FIXTURE.length);
    expect(list[0]).toMatchObject({ id: 2, name: "李四", availablePoints: 860, cumulativePoints: 1640, wecomUserId: "wecom_1002", status: "active" });
    expect(list.some((e) => e.status === "inactive")).toBe(true);
  });

  it("筛选与分页参数清洗后透传（keyword/departmentId/status/page/pageSize）", async () => {
    setResponse(baseResult({ total: 1, rows: [EMPLOYEES_FIXTURE[1]] }));

    await employees({ keyword: "张三", departmentId: 1, status: "active", page: 1, pageSize: 20, });

    expect(httpCalls[0].params).toEqual({ keyword: "张三", departmentId: 1, status: "active", page: 1, pageSize: 20 });
  });

  it("防御兼容：裸数组（后端实现偏差时）原样返回", async () => {
    setResponse(baseResult([...EMPLOYEES_FIXTURE]));
    const list = await employees();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(EMPLOYEES_FIXTURE.length);
  });
});
