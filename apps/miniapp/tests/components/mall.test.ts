import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: unknown[]) => unknown>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb)
}));

vi.mock("../../api/mall/mall", () => ({ fetchGifts: vi.fn() }));
vi.mock("../../api/order/order", () => ({ createOrder: vi.fn(async () => ({ id: 99 })) }));
vi.mock("../../api/home/home", () => ({ fetchHome: vi.fn(async () => ({ pointsBalance: 500 })) }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Mall from "../../pages/mall/index.vue";
import { fetchGifts } from "../../api/mall/mall";
import { createOrder } from "../../api/order/order";

/** 契约 4.7 Gift 形状 */
const GIFTS = [
  { id: 1, name: "机制马克杯", pointsCost: 100, stock: 5, status: "active", deliveryType: "physical" },
  { id: 2, name: "颈椎按摩仪", pointsCost: 200, stock: 3, status: "active", deliveryType: "physical" },
  { id: 3, name: "限量手办", pointsCost: 999, stock: 0, status: "active", deliveryType: "physical" },
  { id: 5, name: "年度大会员", pointsCost: 800, stock: 2, status: "active", deliveryType: "electronic" },
  { id: 4, name: "下架老礼品", pointsCost: 50, stock: 9, status: "inactive", deliveryType: "physical" }
];

let stub!: ReturnType<typeof createUniStub>;

async function mountMall() {
  const wrapper = mount(Mall, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("积分商城（契约 4.7/4.8 / PRD 4.2）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    vi.mocked(fetchGifts).mockResolvedValue(GIFTS as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("礼品渲染：下架隐藏、售罄置灰带「已售罄」标", async () => {
    const wrapper = await mountMall();

    const names = wrapper.findAll(".gift-name").map((n) => n.text());
    expect(names).not.toContain("下架老礼品"); // 下架不展示
    expect(names).toHaveLength(4);
    expect(wrapper.find(".gift.sold").exists()).toBe(true); // 限量手办售罄置灰
    expect(wrapper.find(".cover-tag-sold").text()).toBe("已售罄");
  });

  it("积分不足：弹窗提示且确认按钮禁用，不发兑换请求", async () => {
    const wrapper = await mountMall(); // 余额 500 < 800

    await wrapper.findAll(".gift")[3].trigger("tap"); // 年度大会员 800（有库存但分不够）
    await flushPromises();

    const dialog = wrapper.find(".dialog");
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain("积分不足");
    await wrapper.find(".dialog-ok").trigger("tap");
    await flushPromises();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("可兑换：确认后 createOrder(giftId) 并刷新", async () => {
    const wrapper = await mountMall();

    await wrapper.findAll(".gift")[0].trigger("tap"); // 马克杯 100 < 500
    await flushPromises();
    expect(wrapper.find(".dialog").text()).toContain("确认兑换");

    await wrapper.find(".dialog-ok").trigger("tap");
    await flushPromises();

    expect(createOrder).toHaveBeenCalledWith(1);
    expect(stub.toasts).toContain("兑换申请已提交");
    expect(fetchGifts).toHaveBeenCalledTimes(2); // 提交后重新拉取（余额/库存刷新）
  });

  it("「可兑换礼品」筛选：只显有库存且积分足够的", async () => {
    const wrapper = await mountMall();

    await wrapper.findAll(".chip")[1].trigger("tap");
    await flushPromises();

    const names = wrapper.findAll(".gift-name").map((n) => n.text());
    expect(names).toEqual(["机制马克杯", "颈椎按摩仪"]); // 手办售罄被滤掉
  });
});
