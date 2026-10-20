import { beforeEach, describe, expect, it } from "vitest";
import { orders, ordersPaged, updateOrder } from "../../src/api/order/order";
import { httpCalls, resetHttp, setResponse } from "../helpers/http";
import { ORDERS_FIXTURE } from "../fixtures/order";
import { baseResult } from "../fixtures/rule";

/** L2 契约测试：兑换订单域（docs/Easy-Points-API.md 4.10/4.11 三态状态机） */

beforeEach(() => {
  resetHttp();
});

describe("契约：订单列表（文档 4.10）", () => {
  it("分页查询：status/employeeId 透传，行含 employeeName/giftName/pointsCost 快照", async () => {
    setResponse(baseResult({ total: ORDERS_FIXTURE.length, rows: [...ORDERS_FIXTURE] }));

    const res = await ordersPaged({ page: 1, pageSize: 20, status: "pending_review", employeeId: "" });

    expect(httpCalls[0].method).toBe("get");
    expect(httpCalls[0].url).toBe("/admin/orders");
    expect(httpCalls[0].params).toEqual({ page: 1, pageSize: 20, status: "pending_review" }); // 空 employeeId 被清洗

    expect(res.meta.total).toBe(3);
    expect(res.data[0]).toMatchObject({ id: 5001, employeeName: "张三", giftName: "京东购物卡 100 元", status: "pending_review" });
  });

  it("全量查询（抽屉/计数用）：PageResult 解包为数组", async () => {
    setResponse(baseResult({ total: ORDERS_FIXTURE.length, rows: [...ORDERS_FIXTURE] }));
    const list = await orders();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(3);
  });

});

describe("契约：订单审核（文档 4.11）", () => {
  it("通过：POST /admin/orders/{id}/status 请求体 {status:'approved', remark}", async () => {
    setResponse(baseResult({ ...ORDERS_FIXTURE[0], status: "approved" }));

    await updateOrder(5001, { status: "approved", remark: "审核通过" });

    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/orders/5001/status");
    expect(httpCalls[0].body).toEqual({ status: "approved", remark: "审核通过" });
  });

  it("驳回：请求体 {status:'rejected', remark:'驳回原因'}（同事务自动退分）", async () => {
    setResponse(baseResult({ ...ORDERS_FIXTURE[0], status: "rejected", remark: "礼品缺货" }));
    await updateOrder(5001, { status: "rejected", remark: "礼品缺货" });
    expect(httpCalls[0].body).toEqual({ status: "rejected", remark: "礼品缺货" });
  });

  it("驳回备注为空：HTTP 400 + msg 透传（文档 4.11 错误场景）", async () => {
    setResponse({ code: 0, msg: "处理备注不能为空", data: null }, 400);
    await expect(updateOrder(5001, { status: "rejected", remark: "" })).rejects.toThrow("处理备注不能为空");
  });

  it("重复审核：HTTP 400 状态机文案透传", async () => {
    setResponse({ code: 0, msg: "订单状态不能从 已通过 变更为 已驳回", data: null }, 400);
    await expect(updateOrder(5002, { status: "rejected", remark: "x" })).rejects.toThrow("订单状态不能从 已通过 变更为 已驳回");
  });
});
