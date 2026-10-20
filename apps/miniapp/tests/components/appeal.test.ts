import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: any[]) => any>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onLoad: (cb: (query: Record<string, string>) => void) => (hooks.registry.onLoad ||= []).push(cb)
}));

vi.mock("../../api/appeal/appeal", () => ({ createAppeal: vi.fn(async () => ({ id: 1 })) }));
vi.mock("../../api/upload/upload", () => ({
  uploadImage: vi.fn(async (path: string) => (path.endsWith("1.png") ? "/uploads/ap/mock-1.png" : "/uploads/ap/mock-2.png"))
}));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Appeal from "../../pages/appeal/index.vue";
import { createAppeal } from "../../api/appeal/appeal";
import { uploadImage } from "../../api/upload/upload";

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

  it("关联事项分段展示：摘要按「；」拆行、「：」拆标签；自由备注整段一行", async () => {
    const wrapper = await mountAppeal({
      targetType: "point_application",
      targetId: "994",
      remark: encodeURIComponent("申请分值：10 分；状态：驳回；处理备注：自查测试数据C")
    });

    const items = wrapper.findAll(".related-item");
    expect(items).toHaveLength(3);
    expect(items[0].find(".related-key").text()).toBe("申请分值");
    expect(items[0].find(".related-value").text()).toBe("10 分");
    expect(items[1].find(".related-key").text()).toBe("状态");
    expect(items[2].find(".related-value").text()).toBe("自查测试数据C");

    const plain = await mountAppeal({ targetType: "order", targetId: "7", remark: encodeURIComponent("定制卫衣，尺码备注") });
    expect(plain.findAll(".related-item")).toHaveLength(1);
    expect(plain.find(".related-value").text()).toBe("定制卫衣，尺码备注");
  });

  it("空理由：前端拦截不发请求", async () => {
    const wrapper = await mountAppeal({ targetType: "order", targetId: "7" });

    await wrapper.find(".submit-button").trigger("tap");
    await flushPromises();

    expect(createAppeal).not.toHaveBeenCalled();
    expect(wrapper.find(".error-text").exists()).toBe(true);
  });

  it("佐证图先上传再随申诉提交（11.9 → 7.1 evidenceImages）", async () => {
    (globalThis as unknown as { uni: { chooseImage: (o: { success: (r: { tempFilePaths: string[] }) => void }) => void } }).uni.chooseImage = (o) =>
      o.success({ tempFilePaths: ["tmp://ev-1.png", "tmp://ev-2.png"] });
    const wrapper = await mountAppeal({ targetType: "order", targetId: "7" });

    await wrapper.find(".image-add").trigger("tap");
    await flushPromises();
    wrapper.find(".textarea").setValue("颜色和图片不符");
    await wrapper.find(".submit-button").trigger("tap");
    await flushPromises();

    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect(createAppeal).toHaveBeenCalledWith({
      targetType: "order",
      targetId: "7",
      reason: "颜色和图片不符",
      evidenceImages: ["/uploads/ap/mock-1.png", "/uploads/ap/mock-2.png"]
    });
  });
});
