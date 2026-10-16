import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: any[]) => any>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb)
}));

vi.mock("../../api/home/home", () => ({ fetchHome: vi.fn() }));
vi.mock("../../api/leaderboard/leaderboard", () => ({ fetchLeaderboard: vi.fn() }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Mine from "../../pages/mine/index.vue";
import { fetchHome } from "../../api/home/home";
import { fetchLeaderboard } from "../../api/leaderboard/leaderboard";

/** 契约 2.2 HomeVo + 2.5 LeaderboardEntry */
const HOME = {
  pointsBalance: 1200,
  actualPoints: 1500,
  monthDelta: 50,
  unreadMessages: 2,
  employee: { id: 3, name: "张三", departmentName: "综合管理部", title: "专员" }
};
const BOARD = [
  { id: 1, rank: 1, name: "李四", points: 2000 },
  { id: 3, rank: 2, name: "张三", points: 1200 }
];

let stub!: ReturnType<typeof createUniStub>;

async function mountMine() {
  const wrapper = mount(Mine, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true } }
  });
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("我的页（契约 2.2/2.5）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    vi.mocked(fetchHome).mockResolvedValue(JSON.parse(JSON.stringify(HOME)) as never);
    vi.mocked(fetchLeaderboard).mockResolvedValue(JSON.parse(JSON.stringify(BOARD)) as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("个人信息 + 双积分 + 本人排名", async () => {
    stub.storage.set("employeeId", "3");
    const wrapper = await mountMine();

    expect(fetchHome).toHaveBeenCalled();
    expect(fetchLeaderboard).toHaveBeenCalledWith("realtime");
    expect(wrapper.text()).toContain("张三");
    expect(wrapper.text()).toContain("专员");
    expect(wrapper.text()).toContain("综合管理部");
    expect(wrapper.text()).toContain("1,200"); // 实时积分千分位
    expect(wrapper.text()).toContain("1,500"); // 实际积分千分位
    expect(wrapper.text()).toContain("2"); // 本人在实时榜 rank=2
  });

  it("本人不在榜：排名显示 —，不发异常", async () => {
    stub.storage.set("employeeId", "9");
    const wrapper = await mountMine();

    expect(wrapper.text()).toContain("—");
  });

  it("服务入口：5 项直达对应页面", async () => {
    const wrapper = await mountMine();

    const items = wrapper.findAll(".service");
    expect(items).toHaveLength(5);
    await items[0].trigger("tap");
    expect(stub.navigations[0]).toBe("/pages/apply/index");
  });
});
