import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: unknown[]) => unknown>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb)
}));

vi.mock("../../api/order/order", () => ({ fetchOrders: vi.fn(), createOrder: vi.fn() }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Orders from "../../pages/orders/index.vue";
import { fetchOrders } from "../../api/order/order";

/** 契约 4.9 Order 形状：status 三态 + remark（审核备注，契约输出名） */
const ORDERS = [
  { id: 9, giftId: 2, giftName: "颈椎按摩仪", pointsCost: 200, status: "pending_review", remark: null, createdAt: "2026-10-14 10:00:00" },
  { id: 8, giftId: 1, giftName: "机制马克杯", pointsCost: 100, status: "approved", remark: null, createdAt: "2026-10-13 10:00:00" },
  { id: 7, giftId: 3, giftName: "定制卫衣", pointsCost: 300, status: "rejected", remark: "库存不足，无法兑换", createdAt: "2026-10-12 10:00:00" }
];

let stub!: ReturnType<typeof createUniStub>;

async function mountOrders() {
  const wrapper = mount(Orders, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("兑换记录页（契约 4.9 / PRD 4.2）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    vi.mocked(fetchOrders).mockResolvedValue(ORDERS as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("渲染订单与状态映射：审核中/已通过/已驳回", async () => {
    const wrapper = await mountOrders();

    const cards = wrapper.findAll(".order-card");
    expect(cards).toHaveLength(3);
    expect(cards[0].find(".order-pill").text()).toBe("审核中");
    expect(cards[1].find(".order-pill").text()).toBe("已通过");
    expect(cards[2].find(".order-pill").text()).toBe("已驳回");
  });

  it("驳回原因读契约字段 remark（不再读老字段 reviewRemark）", async () => {
    const wrapper = await mountOrders();

    const reason = wrapper.find(".reject-reason");
    expect(reason.text()).toContain("库存不足，无法兑换");
    expect(wrapper.html()).not.toContain("暂无处理说明");
  });

  it("驳回订单「发起申诉」直达申诉页：targetType=order&targetId（PRD 4.2）", async () => {
    const wrapper = await mountOrders();

    await wrapper.find(".small-button").trigger("tap");

    expect(stub.navigations).toHaveLength(1);
    expect(stub.navigations[0]).toContain("/pages/appeal/index?targetType=order&targetId=7");
    expect(stub.navigations[0]).toContain("remark=" + encodeURIComponent("定制卫衣"));
    // 直达申诉页，不再弹「去积分明细」的引导框
    expect(stub.calls.filter((c) => c.url.includes("/miniapp/appeals"))).toHaveLength(0);
  });

  it("筛选：已驳回 Tab 只显示 rejected 订单", async () => {
    const wrapper = await mountOrders();

    await wrapper.findAll(".segmented .tab")[3].trigger("tap");
    await flushPromises();

    const cards = wrapper.findAll(".order-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].text()).toContain("定制卫衣");
  });
});
