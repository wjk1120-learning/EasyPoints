import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** uni-app 页面钩子捕获器（vi.hoisted 规避 mock 提升限制） */
const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: unknown[]) => unknown>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb),
  onReachBottom: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onReachBottom ||= []).push(cb),
  onPullDownRefresh: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onPullDownRefresh ||= []).push(cb)
}));

vi.mock("../../api/points/points", () => ({ fetchPointRecords: vi.fn() }));
vi.mock("../../api/home/home", () => ({ fetchHome: vi.fn() }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import { buildLargeMonthGroups } from "../fixtures/points";
import Points from "../../pages/points/index.vue";
import { fetchPointRecords } from "../../api/points/points";
import { fetchHome } from "../../api/home/home";

let stub!: ReturnType<typeof createUniStub>;

async function mountPoints() {
  const wrapper = mount(Points, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

function fireReachBottom() {
  for (const cb of hooks.registry.onReachBottom ?? []) cb();
  return flushPromises();
}

describe("积分明细页（契约 2.1 / PRD 4.4）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    delete hooks.registry.onReachBottom;
    vi.mocked(fetchHome).mockResolvedValue({ pointsBalance: 1200 } as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("加载渲染：头部余额 + 初始窗口 20 行 + footer「上拉加载更多」", async () => {
    vi.mocked(fetchPointRecords).mockResolvedValue(buildLargeMonthGroups() as never);

    const wrapper = await mountPoints();

    expect(wrapper.find(".head-num").text()).toBe("1,200");
    expect(wrapper.findAll(".record-card")).toHaveLength(20);
    expect(wrapper.find(".list-footer").text()).toBe("上拉加载更多");
    expect(fetchPointRecords).toHaveBeenCalledTimes(1);
  });

  it("上拉加载更多：20 → 40 → 45，到底后 footer 变「已展示全部明细」", async () => {
    vi.mocked(fetchPointRecords).mockResolvedValue(buildLargeMonthGroups() as never);

    const wrapper = await mountPoints();
    expect(wrapper.findAll(".record-card")).toHaveLength(20);

    await fireReachBottom();
    expect(wrapper.findAll(".record-card")).toHaveLength(40);
    expect(wrapper.find(".list-footer").text()).toBe("上拉加载更多");

    await fireReachBottom();
    expect(wrapper.findAll(".record-card")).toHaveLength(44);
    expect(wrapper.find(".list-footer").text()).toBe("已展示全部明细");

    // 已到底后再触发不再增长
    await fireReachBottom();
    expect(wrapper.findAll(".record-card")).toHaveLength(44);
  });

  it("筛选「人工奖惩」：只显人工行 + 窗口重置（先加载到底再筛选）", async () => {
    vi.mocked(fetchPointRecords).mockResolvedValue(buildLargeMonthGroups() as never);

    const wrapper = await mountPoints();
    await fireReachBottom();
    await fireReachBottom();
    expect(wrapper.findAll(".record-card")).toHaveLength(44);

    await wrapper.findAll(".chip")[3].trigger("tap"); // 人工奖惩
    await flushPromises();

    const cards = wrapper.findAll(".record-card");
    expect(cards).toHaveLength(2); // 仅 2 条人工扣分
    expect(cards[0].text()).toContain("人工扣分");
    expect(wrapper.find(".list-footer").text()).toBe("已展示全部明细");
  });

  it("点流水卡进申诉页：携带 recordId/remark/points/time", async () => {
    vi.mocked(fetchPointRecords).mockResolvedValue(buildLargeMonthGroups() as never);

    const wrapper = await mountPoints();
    await wrapper.find(".record-card").trigger("tap");

    expect(stub.navigations).toHaveLength(1);
    expect(stub.navigations[0]).toContain("/pages/appeal/index?recordId=");
    expect(stub.navigations[0]).toContain("remark=");
  });

  it("PRD 4.4 五要素：事件描述/时间/状态/备注/变动积分齐备，冲正流水有状态标", async () => {
    vi.mocked(fetchPointRecords).mockResolvedValue(buildLargeMonthGroups() as never);

    const wrapper = await mountPoints();
    await fireReachBottom();
    await fireReachBottom(); // 展开全部 44 条（冲正流水排在第 38 位）
    const first = wrapper.find(".record-card");
    // 事件描述 = 来源业务 + 操作人
    expect(first.find(".record-title").text()).toBe("任务奖励 · 系统管理员");
    // 当前状态：正常流水
    expect(first.find(".status-pill").text()).toBe("正常");
    // 操作备注独立成行完整展示
    expect(first.find(".record-remark").text()).toBe("备注：任务奖励 #27");
    // 冲正流水：状态标为「冲正流水」（reversalOfId 非空）
    const html = wrapper.html();
    expect(html).toContain("冲正流水");
    expect(html).toContain("备注：录入错误，冲正");
  });

  it("本月收支卡：只汇总当月加/减（9月数据不计入）", async () => {
    vi.mocked(fetchPointRecords).mockResolvedValue(buildLargeMonthGroups() as never);

    const wrapper = await mountPoints();
    // 10月：+10..+49 累计 1180（40 条任务奖励），负项 -5 -3 人工 + -200 兑换 + -1 冲正
    // monthIn 只算非人工加分 = 1180；monthOut 全部负项 = -209
    expect(wrapper.find(".head-month").text()).toContain("+1,180");
    expect(wrapper.find(".head-month").text()).toContain("-209");
  });
});
