import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** uni-app 页面钩子捕获器（vi.hoisted 规避 mock 提升限制） */
const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: unknown[]) => unknown>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb)
}));

vi.mock("../../api/leaderboard/leaderboard", () => ({ fetchLeaderboard: vi.fn() }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Leaderboard from "../../pages/leaderboard/index.vue";
import { fetchLeaderboard } from "../../api/leaderboard/leaderboard";

/** 契约 2.5 LeaderboardEntry 形状：两榜行均附 availablePoints/actualPoints（两榜分数不同的样本） */
const BOARD = [
  { rank: 1, id: 1, name: "张三", departmentName: "研发部", points: 1200, availablePoints: 1200, actualPoints: 1200, dimension: "realtime" },
  { rank: 2, id: 4, name: "李四", departmentName: "研发部", points: 750, availablePoints: 750, actualPoints: 800, dimension: "realtime" },
  { rank: 3, id: 7, name: "王五", departmentName: "市场部", points: 60, availablePoints: 100, actualPoints: 60, dimension: "realtime" }
];

let stub!: ReturnType<typeof createUniStub>;

async function mountBoard() {
  const wrapper = mount(Leaderboard, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("积分排行榜（契约 2.5 / PRD 4.5）", () => {
  beforeEach(() => {
    stub = createUniStub();
    stub.storage.set("employeeId", "4"); // 我是李四
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    vi.mocked(fetchLeaderboard).mockResolvedValue(BOARD as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("默认实际积分榜：dimension=cumulative，分数取 actualPoints", async () => {
    const wrapper = await mountBoard();

    expect(fetchLeaderboard).toHaveBeenCalledWith("cumulative");
    const rows = wrapper.findAll(".board-row");
    expect(rows).toHaveLength(3);
    expect(rows[0].find(".board-name").text()).toBe("张三");
    expect(rows[1].find(".board-points").text()).toBe("800"); // 李四按累计积分
    // 双榜字段已由后端提供：不再出现「两页签同一份」占位文案
    expect(wrapper.html()).not.toContain("同一份可用积分");
  });

  it("切实时榜：dimension=realtime，分数取 availablePoints", async () => {
    const wrapper = await mountBoard();

    await wrapper.findAll(".segmented .tab")[1].trigger("tap");
    await flushPromises();

    expect(fetchLeaderboard).toHaveBeenLastCalledWith("realtime");
    const rows = wrapper.findAll(".board-row");
    expect(rows[1].find(".board-points").text()).toBe("750"); // 李四按可用积分
    expect(rows[2].find(".board-points").text()).toBe("100"); // 王五按可用积分
  });

  it("我的排名置顶卡：高亮本人（李四）及其当前榜分数", async () => {
    const wrapper = await mountBoard();

    const mine = wrapper.find(".my-rank");
    expect(mine.exists()).toBe(true);
    expect(mine.find(".my-name").text()).toBe("李四（我）");
    expect(mine.find(".my-points").text()).toBe("800");
  });
});
