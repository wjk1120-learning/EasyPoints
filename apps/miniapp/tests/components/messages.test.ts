import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: any[]) => any>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb),
  onReachBottom: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onReachBottom ||= []).push(cb)
}));

vi.mock("../../api/message/message", () => ({
  fetchMessages: vi.fn(),
  markMessageRead: vi.fn(async () => ({})),
  markAllMessagesRead: vi.fn(async () => ({}))
}));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Messages from "../../pages/messages/index.vue";
import { fetchMessages, markMessageRead, markAllMessagesRead } from "../../api/message/message";

/** 契约 10.1 Message 形状：附录 E 枚举 type + 顶层 voteId 深链（字段名以契约为准：isRead） */
const PAGE1 = {
  data: [
    { id: 1, type: "vote_invitation", title: "系统通知", summary: "有新的投票待你参与：Q4 团建方案评选", isRead: false, voteId: 12, createdAt: "2026-10-15 10:00:00" },
    { id: 2, type: "order_status", title: "兑换审核结果", summary: "你的兑换「颈椎按摩仪」已通过审核", isRead: false, voteId: null, orderId: 88, createdAt: "2026-10-14 10:00:00" },
    { id: 3, type: "point_changed", title: "积分变动", summary: "人工扣分：迟到，-5 分", isRead: true, voteId: null, createdAt: "2026-10-13 10:00:00" }
  ],
  meta: { total: 4, page: 1, pageSize: 20 }
};

const PAGE2 = {
  data: [
    { id: 4, type: "task_review", title: "任务审核结果", summary: "「知识库整理」已通过", isRead: false, voteId: null, createdAt: "2026-10-12 10:00:00" }
  ],
  meta: { total: 4, page: 2, pageSize: 20 }
};

let stub!: ReturnType<typeof createUniStub>;

async function mountMessages() {
  const wrapper = mount(Messages, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("通知中心（契约 10.1~10.3 / 附录 E / PRD 4.8）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    delete hooks.registry.onReachBottom;
    // 深拷贝 fixture：组件会原地改 isRead，跨用例共享对象会互相污染
    vi.mocked(fetchMessages).mockResolvedValue(JSON.parse(JSON.stringify(PAGE1)) as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("PageResult 解析 + 契约枚举映射类型标签 + 未读数", async () => {
    const wrapper = await mountMessages();

    expect(fetchMessages).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    const msgs = wrapper.findAll(".msg");
    expect(msgs).toHaveLength(3);
    expect(wrapper.find(".msg-tag").text()).toBe("投票");
    expect(wrapper.html()).toContain("兑换审核");
    expect(wrapper.find(".list-head-text").text()).toContain("2 条未读消息");
  });

  it("投票消息点击：读顶层 voteId 直达投票详情（不再解析 summary），并发已读", async () => {
    const wrapper = await mountMessages();

    await wrapper.findAll(".msg")[0].trigger("tap");
    await flushPromises();

    expect(markMessageRead).toHaveBeenCalledWith(1);
    expect(stub.navigations[0]).toBe("/pages/vote/index?id=12");
  });

  it("普通消息点击：进消息详情页", async () => {
    const wrapper = await mountMessages();

    await wrapper.findAll(".msg")[1].trigger("tap");
    await flushPromises();

    expect(stub.navigations[0]).toContain("/pages/message/index?id=2");
    expect(stub.navigations[0]).toContain(encodeURIComponent("兑换审核结果"));
    expect(stub.navigations[0]).toContain("orderId=88"); // 深链业务 ID 透传（反馈清单 #3）
  });

  it("上拉加载第二页：追加且到总数后 footer 显示已全部", async () => {
    const wrapper = await mountMessages();
    expect(wrapper.find(".list-footer").text()).toBe("上拉加载更多");

    vi.mocked(fetchMessages).mockResolvedValue(PAGE2 as never);
    for (const cb of hooks.registry.onReachBottom ?? []) cb();
    await flushPromises();

    expect(fetchMessages).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
    expect(wrapper.findAll(".msg")).toHaveLength(4);
    expect(wrapper.find(".list-footer").text()).toBe("已展示全部消息");
  });

  it("重复点击已读过的消息：不再发第二次已读请求（后端对重复标已读 404）", async () => {
    const wrapper = await mountMessages();

    await wrapper.findAll(".msg")[0].trigger("tap"); // 第一次：标已读
    await flushPromises();
    await wrapper.findAll(".msg")[0].trigger("tap"); // 第二次：本地已记录，跳过
    await flushPromises();

    expect(markMessageRead).toHaveBeenCalledTimes(1);
  });

  it("全部已读：调契约 10.3 read-all 批量接口，单条接口不发，全部行置已读", async () => {
    const wrapper = await mountMessages();

    await wrapper.find(".list-head-read").trigger("tap");
    await flushPromises();

    expect(markAllMessagesRead).toHaveBeenCalledTimes(1);
    expect(markMessageRead).not.toHaveBeenCalled();
    expect(wrapper.find(".list-head-text").text()).toContain("消息已全部已读");
    expect(wrapper.findAll(".msg-read")).toHaveLength(3);
  });
});
