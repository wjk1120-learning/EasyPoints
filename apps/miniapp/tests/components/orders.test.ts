import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: unknown[]) => unknown>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb),
  onLoad: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onLoad ||= []).push(cb)
}));

vi.mock("../../api/order/order", () => ({ fetchOrders: vi.fn(), createOrder: vi.fn() }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Orders from "../../pages/orders/index.vue";
import { fetchOrders } from "../../api/order/order";
import { homeBadges } from "../../utils/badge-state";

/** 契约 4.9 Order 形状：status 三态 + remark（审核备注，契约输出名） */
const ORDERS = [
  { id: 9, giftId: 2, giftName: "颈椎按摩仪", pointsCost: 200, status: "pending_review", remark: null, createdAt: "2026-10-14 10:00:00" },
  { id: 8, giftId: 1, giftName: "机制马克杯", pointsCost: 100, status: "approved", remark: null, createdAt: "2026-10-13 10:00:00" },
  { id: 7, giftId: 3, giftName: "定制卫衣", pointsCost: 300, status: "rejected", remark: "库存不足，无法兑换", createdAt: "2026-10-12 10:00:00" }
];

let stub!: ReturnType<typeof createUniStub>;

async function mountOrders(query?: Record<string, string>) {
  const wrapper = mount(Orders, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
  // uni-app onLoad(query) 先于 onShow：有参数时先派发 onLoad 再触发 onShow（与真实时序一致）
  if (query) {
    for (const cb of hooks.registry.onLoad ?? []) await cb(query);
  }
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("兑换记录页（契约 4.9 / PRD 4.2）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    delete hooks.registry.onLoad;
    homeBadges.orders = 0;
    stub.storage.delete("orders:seenIds");
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

  it("未读徽标：仅已通过/已驳回显示（审核中不显示），点击后清零且持久化", async () => {
    const wrapper = await mountOrders();

    // 首次使用（无已读记录）：已通过/已驳回各 1 条未读；审核中/全部不显示徽标
    let tabs = wrapper.findAll(".segmented .tab");
    expect(tabs[0].text()).toBe("全部");
    expect(tabs[1].text()).toBe("审核中");
    expect(tabs[2].text()).toBe("已通过1");
    expect(tabs[3].text()).toBe("已驳回1");

    // 点击「已通过」：提醒完成清零，「已驳回」不受影响
    await tabs[2].trigger("tap");
    await flushPromises();
    tabs = wrapper.findAll(".segmented .tab");
    expect(tabs[2].text()).toBe("已通过");
    expect(tabs[3].text()).toBe("已驳回1");

    // 已读持久化：重挂载（模拟退出再进）后「已通过」仍为 0、「已驳回」仍提醒
    const again = await mountOrders();
    tabs = again.findAll(".segmented .tab");
    expect(tabs[2].text()).toBe("已通过");
    expect(tabs[3].text()).toBe("已驳回1");
  });

  it("点「全部」= 已通过/已驳回一并已读", async () => {
    const wrapper = await mountOrders();

    await wrapper.findAll(".segmented .tab")[0].trigger("tap");
    await flushPromises();

    const tabs = wrapper.findAll(".segmented .tab");
    expect(tabs[2].text()).toBe("已通过");
    expect(tabs[3].text()).toBe("已驳回");
  });

  it("新状态变化重新计入未读：已读后某订单从审核中变为已通过，已通过 +1", async () => {
    const wrapper = await mountOrders();
    await wrapper.findAll(".segmented .tab")[0].trigger("tap"); // 全部已读
    await flushPromises();

    // 模拟管理员审核：id=9 从 pending_review → approved（updatedAt 流转）
    vi.mocked(fetchOrders).mockResolvedValue([
      { ...ORDERS[1], id: 9, giftName: "颈椎按摩仪", status: "approved", updatedAt: "2026-10-20 16:00:00" },
      ...ORDERS.slice(1)
    ] as never);
    // 触发 onShow 重新拉取（重新注册并执行）
    for (const cb of hooks.registry.onShow ?? []) await cb();
    await flushPromises();

    const tabs = wrapper.findAll(".segmented .tab");
    expect(tabs[2].text()).toBe("已通过1"); // id=9 状态流转为新变化
    expect(tabs[1].text()).toBe("审核中"); // 审核中清空
  });

  it("角标联动：加载后把审核中订单总数写入共享状态（供首页/底栏徽标，总数口径不受已读影响）", async () => {
    await mountOrders();

    expect(homeBadges.orders).toBe(1); // fixture 中仅 id=9 为 pending_review
  });

  it("首页入口带 filter=pending：默认落在审核中视图，数据到位后该状态视同点击已读", async () => {
    const wrapper = await mountOrders({ filter: "pending" });

    // 默认落在审核中视图：只显示审核中订单
    expect(wrapper.findAll(".order-card")).toHaveLength(1);
    expect(wrapper.find(".order-name").text()).toBe("颈椎按摩仪");
    // 直落即已读：审核中徽标清零，其他状态不受影响
    const tabs = wrapper.findAll(".segmented .tab");
    expect(tabs[1].text()).toBe("审核中");
    expect(tabs[2].text()).toBe("已通过1");
    // 已读持久化：重挂载（不带参）后审核中仍为 0
    const again = await mountOrders();
    expect(again.findAll(".segmented .tab")[1].text()).toBe("审核中");
  });
});
