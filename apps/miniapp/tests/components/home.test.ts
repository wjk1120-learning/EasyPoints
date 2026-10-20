import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

/** uni-app 页面钩子捕获器：onShow/onPullDownRefresh 注册的回调存进注册表，测试里手动触发。
    vi.mock 工厂会被提升到文件顶部，外部变量必须经 vi.hoisted 才能安全引用 */
const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: unknown[]) => unknown>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb),
  onPullDownRefresh: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onPullDownRefresh ||= []).push(cb),
  onLoad: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onLoad ||= []).push(cb),
  onReachBottom: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onReachBottom ||= []).push(cb)
}));

vi.mock("../../api/home/home", () => ({ fetchHome: vi.fn() }));
vi.mock("../../api/vote/vote", () => ({ fetchVotesPaged: vi.fn() }));
vi.mock("../../api/order/order", () => ({ fetchOrders: vi.fn() }));
vi.mock("../../api/application/application", () => ({ fetchApplications: vi.fn() }));
vi.mock("../../api/auth/auth", () => ({
  loginEmployee: vi.fn(async () => ({ accessToken: "test-token", employee: { id: 1 } })),
  clearEmployeeAuth: vi.fn(),
  clearAuthError: vi.fn(),
  markNetworkError: vi.fn()
}));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Home from "../../pages/home/index.vue";
import { fetchHome } from "../../api/home/home";
import { fetchVotesPaged } from "../../api/vote/vote";
import { fetchOrders } from "../../api/order/order";
import { fetchApplications } from "../../api/application/application";

/** 契约 2.2 HomeVo 形状的测试数据（对齐 docs/Easy-Points-API.md 示例） */
const HOME_PAYLOAD = {
  employee: { id: 1, name: "张三", departmentName: "研发部", pointsBalance: 1200 },
  pointsBalance: 1200,
  cumulativePoints: 1200,
  actualPoints: 1200,
  monthDelta: 1200,
  unreadMessages: 2,
  recentRecords: [
    { id: 101, pointsDelta: 50, type: "performance", sourceType: "task_reward", remark: "任务奖励：月度之星评选", occurredAt: "2026-10-09 15:30:00" },
    { id: 102, pointsDelta: -1, type: "reversal", sourceType: "reversal", remark: "联调冒烟冲正", occurredAt: "2026-10-10 09:00:00" }
  ]
};

let stub!: ReturnType<typeof createUniStub>;

async function mountHome() {
  const wrapper = mount(Home, {
    global: {
      // NavBar/AppTabBar 依赖 uni 运行时能力，组件测试只关心页面本体
      stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true }
    }
  });
  // uni-app onShow 在页面显示时触发：注册后手动触发并对齐异步
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("首页（契约 2.2 / PRD 4.1）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    vi.mocked(fetchOrders).mockResolvedValue([] as never);
    vi.mocked(fetchApplications).mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 50 } } as never);
    delete hooks.registry.onShow;
    delete hooks.registry.onPullDownRefresh;
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("onShow 拉取聚合数据：双积分卡 + 姓名 + 最近流水（recentRecords 直用，不再自拉流水）", async () => {
    vi.mocked(fetchHome).mockResolvedValue(HOME_PAYLOAD as never);
    vi.mocked(fetchVotesPaged).mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 50 } } as never);

    const wrapper = await mountHome();

    expect(wrapper.find(".hero-name").text()).toBe("张三");
    const nums = wrapper.findAll(".hero-num").map((n) => n.text());
    expect(nums).toEqual(["1,200", "1,200"]);
    expect(wrapper.findAll(".recent-row")).toHaveLength(2);
    expect(wrapper.find(".recent-title").text()).toBe("任务奖励：月度之星评选");
    // 只发一次聚合请求（fetchHome），不再请求 points/records
    expect(fetchHome).toHaveBeenCalledTimes(1);
    expect(stub.calls.map((c) => c.url)).not.toContain("/miniapp/points/records");
  });

  it("快捷入口 6 项（申请中心更名「我的申请」并直落列表，余下定稿口径不变）", async () => {
    vi.mocked(fetchHome).mockResolvedValue(HOME_PAYLOAD as never);
    vi.mocked(fetchVotesPaged).mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 50 } } as never);

    const wrapper = await mountHome();

    const labels = wrapper.findAll(".shortcut-label").map((n) => n.text());
    expect(labels).toEqual(["我的申请", "通知中心", "投票中心", "积分排名", "兑换记录", "规则中心"]);
  });

  it("角标：通知中心显示未读消息数、我的投票显示待参与 total、兑换记录显示审核中订单数", async () => {
    vi.mocked(fetchHome).mockResolvedValue(HOME_PAYLOAD as never);
    vi.mocked(fetchVotesPaged).mockResolvedValue({
      data: [{ id: "v1", submitted: false }, { id: "v2", submitted: false }, { id: "v3", submitted: false }],
      meta: { total: 3, page: 1, pageSize: 50 }
    } as never);
    vi.mocked(fetchOrders).mockResolvedValue([
      { id: 9001, status: "pending_review" },
      { id: 9002, status: "pending_review" }
    ] as never);
    vi.mocked(fetchApplications).mockResolvedValue({
      data: [{ id: 21, status: "pending_review" }, { id: 20, status: "approved" }],
      meta: { total: 2, page: 1, pageSize: 50 }
    } as never);

    const wrapper = await mountHome();

    const badges = wrapper.findAll(".shortcut-badge").map((n) => n.text());
    expect(badges).toContain("2"); // unreadMessages
    expect(badges).toContain("3"); // 待参与投票 total
    expect(badges).toContain("2"); // 审核中订单数
    expect(badges).toContain("1"); // 待审核申请数
    expect(fetchVotesPaged).toHaveBeenCalledWith("pending", { page: 1, pageSize: 50 });
    expect(fetchOrders).toHaveBeenCalledWith("pending_review");
  });

  it("角标失败兜底：投票/订单角标接口报错时归 0，不影响首页主数据", async () => {
    vi.mocked(fetchHome).mockResolvedValue(HOME_PAYLOAD as never);
    vi.mocked(fetchVotesPaged).mockRejectedValue(new Error("boom") as never);
    vi.mocked(fetchOrders).mockRejectedValue(new Error("boom") as never);

    const wrapper = await mountHome();

    expect(wrapper.find(".hero-name").text()).toBe("张三");
    expect(wrapper.findAll(".shortcut-badge")).toHaveLength(1); // 仅剩未读消息角标
  });

  it("加载失败且无缓存：错误提示区展示后端 msg 原文", async () => {
    vi.mocked(fetchHome).mockRejectedValue(new Error("员工不存在") as never);
    vi.mocked(fetchVotesPaged).mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 50 } } as never);

    const wrapper = await mountHome();

    expect(wrapper.find(".notice").text()).toContain("员工不存在");
    expect(stub.toasts).toContain("员工不存在");
  });
});
