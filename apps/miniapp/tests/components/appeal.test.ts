import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: any[]) => any>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onLoad: (cb: (query: Record<string, string>) => void) => (hooks.registry.onLoad ||= []).push(cb)
}));

vi.mock("../../api/appeal/appeal", () => ({ createAppeal: vi.fn(async () => ({ id: 1 })) }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Appeal from "../../pages/appeal/index.vue";
import { createAppeal } from "../../api/appeal/appeal";

let stub!: ReturnType<typeof createUniStub>;

async function mountAppeal(query: Record<string, string>) {
  const wrapper = mount(Appeal, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true } }
  });
  for (const cb of hooks.registry.onLoad ?? []) cb(query);
  await flushPromises();
  return wrapper;
}

describe("发起申诉页（契约 7.1 / PRD 4.8）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onLoad;
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("订单入口：payload 为 { targetType: 'order', targetId, reason }（契约 7.1）", async () => {
    const wrapper = await mountAppeal({
      targetType: "order",
      targetId: "7",
      remark: encodeURIComponent("定制卫衣"),
      points: "-300"
    });

    wrapper.find(".textarea").setValue("颜色和图片不符");
    await wrapper.find(".submit-button").trigger("tap");
    await flushPromises();

    expect(createAppeal).toHaveBeenCalledWith({ targetType: "order", targetId: "7", reason: "颜色和图片不符" });
    expect(stub.toasts).toContain("申诉已提交");
    // 关联事项标签按目标类型切换
    expect(wrapper.find(".card .muted").text()).toContain("兑换订单");
  });

  it("积分明细旧入口（recordId）：映射为 point_record 目标", async () => {
    const wrapper = await mountAppeal({
      recordId: "102",
      remark: encodeURIComponent("10月考勤扣分"),
      points: "-5"
    });

    wrapper.find(".textarea").setValue("当天已提前请假");
    await wrapper.find(".submit-button").trigger("tap");
    await flushPromises();

    expect(createAppeal).toHaveBeenCalledWith({ targetType: "point_record", targetId: "102", reason: "当天已提前请假" });
    expect(wrapper.find(".card .muted").text()).toContain("积分明细");
  });

  it("空理由：前端拦截不发请求", async () => {
    const wrapper = await mountAppeal({ targetType: "order", targetId: "7" });

    await wrapper.find(".submit-button").trigger("tap");
    await flushPromises();

    expect(createAppeal).not.toHaveBeenCalled();
    expect(wrapper.find(".error-text").exists()).toBe(true);
  });
});
