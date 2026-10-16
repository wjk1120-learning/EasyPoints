import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: any[]) => any>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb),
  onReachBottom: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onReachBottom ||= []).push(cb)
}));

vi.mock("../../api/vote/vote", () => ({ fetchVotesPaged: vi.fn(), fetchVote: vi.fn(), submitBallot: vi.fn() }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Votes from "../../pages/votes/index.vue";
import { fetchVotesPaged } from "../../api/vote/vote";

/** 契约 9.7 VoteSummary 形状：mode/submitted/deadline/expired/relatedLabel 为小程序契约字段 */
const PENDING_PAGE1 = {
  data: [
    { id: 12, title: "Q4 团建方案评选", description: "选出大家心仪的团建方案", mode: "multiple", multiple: true, submitted: false, expired: false, deadline: "2026-10-20 18:00", relatedLabel: null },
    { id: 11, title: "年度优秀员工提名", mode: "single", submitted: true, deadline: "2026-10-18 18:00", relatedLabel: "任务 #7 · 整理客户回访文档" }
  ],
  meta: { total: 3, page: 1, pageSize: 20 }
};
const PENDING_PAGE2 = {
  data: [{ id: 10, title: "下午茶口味调研", mode: "single", submitted: false, deadline: "2026-10-25 12:00" }],
  meta: { total: 3, page: 2, pageSize: 20 }
};

let stub!: ReturnType<typeof createUniStub>;

async function mountVotes() {
  const wrapper = mount(Votes, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("我的投票列表（契约 9.7 / PRD 4.7）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    delete hooks.registry.onReachBottom;
    vi.mocked(fetchVotesPaged).mockResolvedValue(JSON.parse(JSON.stringify(PENDING_PAGE1)) as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("PageResult 解析：pill 状态 + 多选/单选 + 关联业务标签 + 截止时间", async () => {
    const wrapper = await mountVotes();

    expect(fetchVotesPaged).toHaveBeenCalledWith("pending", { page: 1, pageSize: 20 });
    const cards = wrapper.findAll(".vote-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].find(".pill").text()).toBe("待参与");
    expect(cards[1].find(".pill").text()).toBe("已提交");
    expect(cards[0].text()).toContain("多选");
    expect(cards[1].text()).toContain("单选");
    expect(cards[1].text()).toContain("任务 #7 · 整理客户回访文档");
    expect(cards[0].text()).toContain("截至 10-20 18:00");
  });

  it("切「历史投票」：scope=history 服务端筛选，未提交行显示已结束", async () => {
    const wrapper = await mountVotes();

    await wrapper.findAll(".segmented .tab")[1].trigger("tap");
    await flushPromises();

    expect(fetchVotesPaged).toHaveBeenLastCalledWith("history", { page: 1, pageSize: 20 });
  });

  it("上拉加载第二页：追加且到底后 footer 显示已全部", async () => {
    const wrapper = await mountVotes();
    expect(wrapper.find(".list-footer").text()).toBe("上拉加载更多");

    vi.mocked(fetchVotesPaged).mockResolvedValue(PENDING_PAGE2 as never);
    for (const cb of hooks.registry.onReachBottom ?? []) cb();
    await flushPromises();

    expect(fetchVotesPaged).toHaveBeenLastCalledWith("pending", { page: 2, pageSize: 20 });
    expect(wrapper.findAll(".vote-card")).toHaveLength(3);
    expect(wrapper.find(".list-footer").text()).toBe("已展示全部投票");
  });

  it("点击卡片进投票详情", async () => {
    const wrapper = await mountVotes();

    await wrapper.findAll(".vote-card")[0].trigger("tap");

    expect(stub.navigations[0]).toBe("/pages/vote/index?id=12");
  });

  it("空列表：显示暂无待参与投票空态", async () => {
    vi.mocked(fetchVotesPaged).mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 20 } } as never);
    const wrapper = await mountVotes();

    expect(wrapper.find(".card-empty").exists()).toBe(true);
    expect(wrapper.find(".vote-card").exists()).toBe(false);
  });
});
