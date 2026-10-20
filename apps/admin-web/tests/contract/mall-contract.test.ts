import { beforeEach, describe, expect, it } from "vitest";
import { adjustGiftStock, createGift, mallGifts, publishGift, updateGift } from "../../src/api/mall/mall";
import { httpCalls, resetHttp, setResponse } from "../helpers/http";
import { GIFTS_FIXTURE, GIFT_STOCK_ADJUSTED } from "../fixtures/mall";
import { baseResult } from "../fixtures/rule";

/** L2 契约测试：礼品商城域（docs/Easy-Points-API.md 4.1~4.5，2026-10-13 定稿列表为 PageResult 包装） */

beforeEach(() => {
  resetHttp();
});

describe("契约：礼品列表（文档 4.1）", () => {
  it("GET /admin/mall/gifts 无参：PageResult 包装解包为数组（含下架礼品）", async () => {
    setResponse(baseResult({ total: GIFTS_FIXTURE.length, rows: [...GIFTS_FIXTURE] }));

    const list = await mallGifts();

    expect(httpCalls[0].method).toBe("get");
    expect(httpCalls[0].url).toBe("/admin/mall/gifts");

    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id: 1, name: "京东购物卡 100 元", pointsCost: 1000, stock: 20, limitPerUser: 2 });
    expect(list.some((g) => g.status === "inactive")).toBe(true);
  });

});

describe("契约：新增礼品（文档 4.2）", () => {
  it("POST /admin/mall/gifts 请求体含 stock（新建可填），响应解包为 Gift", async () => {
    setResponse(baseResult(GIFTS_FIXTURE[0]));

    const created = await createGift({
      name: "京东购物卡 100 元",
      pointsCost: 1000,
      stock: 20,
      limitPerUser: 2,
      status: "active",
    });

    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/mall/gifts");
    expect(httpCalls[0].body).toEqual({ name: "京东购物卡 100 元", pointsCost: 1000, stock: 20, limitPerUser: 2, status: "active" });
    expect(created.id).toBe(1);
  });

  it("重名：HTTP 400 + msg 透传（文档 4.2 错误场景）", async () => {
    setResponse({ code: 0, msg: "礼品名称已存在（含已下架礼品）", data: null }, 400);
    await expect(
      createGift({ name: "京东购物卡 100 元", pointsCost: 1000, limitPerUser: null, status: "inactive" }),
    ).rejects.toThrow("礼品名称已存在（含已下架礼品）");
  });
});

describe("契约：编辑礼品（文档 4.3 编辑不覆盖库存）", () => {
  it("PUT /admin/mall/gifts/{id}：调用方传 stock 原值（新后端忽略该字段）", async () => {
    setResponse(baseResult(GIFTS_FIXTURE[0]));

    await updateGift(1, { name: "京东购物卡 100 元", pointsCost: 1200, stock: 20, limitPerUser: 2, status: "active" });

    expect(httpCalls[0].method).toBe("put");
    expect(httpCalls[0].url).toBe("/admin/mall/gifts/1");
    expect(httpCalls[0].body).toMatchObject({ name: "京东购物卡 100 元", pointsCost: 1200, stock: 20 });
  });
});

describe("契约：调整库存（文档 4.4）", () => {
  it("POST /admin/mall/gifts/{id}/stock 请求体仅 {delta}，响应为更新后 Gift", async () => {
    setResponse(baseResult(GIFT_STOCK_ADJUSTED));

    const updated = await adjustGiftStock(1, 5);

    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/mall/gifts/1/stock");
    expect(httpCalls[0].body).toEqual({ delta: 5 });

    expect(updated.stock).toBe(25);
    expect(updated.updatedAt).toBe("2026-10-13 10:30:00");
  });

  it("负数减库存：delta 为负值原样传递", async () => {
    setResponse(baseResult({ ...GIFTS_FIXTURE[0], stock: 17 }));
    await adjustGiftStock(1, -3);
    expect(httpCalls[0].body).toEqual({ delta: -3 });
  });

  it("调整后为负：HTTP 400 + msg 透传（文档 4.4 错误场景）", async () => {
    setResponse({ code: 0, msg: "调整后库存不能为负", data: null }, 400);
    await expect(adjustGiftStock(2, -10)).rejects.toThrow("调整后库存不能为负");
  });
});

describe("契约：上架（文档 4.5）", () => {
  it("POST /admin/mall/gifts/{id}/publish", async () => {
    setResponse(baseResult(GIFTS_FIXTURE[0]));
    await publishGift(1);
    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/mall/gifts/1/publish");
  });
});
