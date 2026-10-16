import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(query?: Record<string, string>) => void>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onLoad: (cb: (query?: Record<string, string>) => void) => (hooks.registry.onLoad ||= []).push(cb)
}));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import MessageDetail from "../../pages/message/index.vue";

let stub!: ReturnType<typeof createUniStub>;

async function mountDetail(query: Record<string, string>) {
  const wrapper = mount(MessageDetail, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true } }
  });
  for (const cb of hooks.registry.onLoad ?? []) cb(query);
  await flushPromises();
  return wrapper;
}

/** 消息详情申诉入口：有深链 ID 直达申诉表单（契约 7.1 targetType/targetId），无 ID 降级到能一键申诉的页面 */
describe("消息详情申诉入口（PRD 4.8 / 后端反馈清单 #3）", () => {
  beforeEach(() => {
    stub = createUniStub();
    delete hooks.registry.onLoad;
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("带业务 ID 的申请驳回消息：直达申诉表单并预填 targetType/targetId", async () => {
    const summary = "申请分值：20 分 状态：已驳回";
    const wrapper = await mountDetail({
      id: "12",
      type: "application_review",
      title: "积分申请审核结果",
      summary,
      applicationId: "7",
      createdAt: "2026-10-15 15:21:00"
    });

    expect(wrapper.find(".button").text()).toBe("发起申诉");
    await wrapper.find(".button").trigger("tap");

    expect(stub.navigations[0]).toContain("/pages/appeal/index?");
    expect(stub.navigations[0]).toContain("targetType=point_application");
    expect(stub.navigations[0]).toContain("targetId=7");
    expect(stub.navigations[0]).toContain(`remark=${encodeURIComponent(summary)}`);
  });

  it("积分变动消息带 pointRecordId：直达流水申诉（targetType=point_record）", async () => {
    const wrapper = await mountDetail({ id: "3", type: "point_changed", title: "积分变动", summary: "人工扣分：迟到", pointRecordId: "33" });

    await wrapper.find(".button").trigger("tap");

    expect(stub.navigations[0]).toContain("/pages/appeal/index?");
    expect(stub.navigations[0]).toContain("targetType=point_record&targetId=33");
  });

  it("无业务 ID 降级：task_review 预切「我的」任务标签（storage 握手 + switchTab）", async () => {
    const wrapper = await mountDetail({ id: "4", type: "task_review", title: "任务审核结果", summary: "「调研报告撰写」已驳回" });

    await wrapper.find(".button").trigger("tap");

    expect(stub.storage.get("tasks:pendingScope")).toBe("mine");
    expect(stub.navigations[0]).toBe("/pages/tasks/index");
  });

  it("无业务 ID 降级：application_review 去「我的申请」、order_status 去「我的订单」、point_changed 去明细", async () => {
    const apply = await mountDetail({ id: "5", type: "application_review", title: "积分申请审核结果", summary: "状态：已驳回" });
    await apply.find(".button").trigger("tap");

    const order = await mountDetail({ id: "6", type: "order_status", title: "兑换审核结果", summary: "「颈椎按摩仪」已驳回" });
    await order.find(".button").trigger("tap");

    const point = await mountDetail({ id: "7", type: "point_changed", title: "积分变动", summary: "人工扣分：迟到" });
    await point.find(".button").trigger("tap");

    expect(stub.navigations).toEqual(["/pages/apply/index?view=mine", "/pages/orders/index", "/pages/points/index"]);
  });

  it("申诉结果消息：不再提供申诉入口（结果不可再诉）", async () => {
    const wrapper = await mountDetail({ id: "8", type: "appeal_result", title: "申诉结果通知", summary: "处理结果：驳回" });

    expect(wrapper.find(".button").exists()).toBe(false);
  });
});
