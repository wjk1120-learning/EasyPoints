import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: any[]) => any>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb),
  onReachBottom: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onReachBottom ||= []).push(cb)
}));

vi.mock("../../api/appeal/appeal", () => ({ fetchAppeals: vi.fn(), createAppeal: vi.fn() }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Appeals from "../../pages/appeals/index.vue";
import { fetchAppeals } from "../../api/appeal/appeal";

/** 契约 7.2 Appeal 形状：statusText/resolution 为后端计算字段，一级三态 */
const PAGE1 = {
  data: [
    { id: 31, targetType: "point_application", targetId: 19, reason: "贡献认定与实际支援情况不符", status: "pending_review", statusText: "待审核", createdAt: "2026-10-15 10:00:00" },
    { id: 30, targetType: "point_record", targetId: 55, pointRecordId: 55, reason: "扣分依据与考勤记录不符", status: "approved", statusText: "审核通过", resolution: "核实后已恢复积分", createdAt: "2026-10-14 10:00:00" },
    { id: 29, targetType: "order", targetId: 8, reason: "礼品图片与实物不符", status: "rejected", statusText: "已驳回", resolution: "兑换规则已公示，维持原结论", createdAt: "2026-10-13 10:00:00" }
  ],
  meta: { total: 4, page: 1, pageSize: 20 }
};
const PAGE2 = {
  data: [{ id: 28, targetType: "task_claim", targetId: 55, reason: "成果已按期提交", status: "rejected", statusText: "已驳回", resolution: "报告深度不足", createdAt: "2026-10-12 10:00:00" }],
  meta: { total: 4, page: 2, pageSize: 20 }
};

let stub!: ReturnType<typeof createUniStub>;

async function mountAppeals() {
  const wrapper = mount(Appeals, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("申诉记录列表（契约 7.2 / PRD 4.8）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    delete hooks.registry.onReachBottom;
    // 深拷贝 fixture，防跨用例污染
    vi.mocked(fetchAppeals).mockResolvedValue(JSON.parse(JSON.stringify(PAGE1)) as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("PageResult 解析：三态 pill 用后端 statusText + 目标类型中文", async () => {
    const wrapper = await mountAppeals();

    expect(fetchAppeals).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    const cards = wrapper.findAll(".appeal-card");
    expect(cards).toHaveLength(3);
    expect(cards[0].find(".pill").text()).toBe("待审核");
    expect(cards[1].find(".pill").text()).toBe("审核通过");
    expect(cards[1].find(".pill").classes()).toContain("green");
    expect(cards[2].find(".pill").text()).toBe("已驳回");
    expect(cards[0].text()).toContain("积分申请");
    expect(cards[1].text()).toContain("积分明细");
    expect(cards[2].text()).toContain("兑换订单");
  });

  it("切「待审核」标签：按契约 status 参数服务端筛选", async () => {
    const wrapper = await mountAppeals();

    await wrapper.findAll(".segmented .tab")[1].trigger("tap");
    await flushPromises();

    expect(fetchAppeals).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, status: "pending_review" });
  });

  it("驳回行 banner 展示处理意见（resolution=后端处理备注别名）", async () => {
    const wrapper = await mountAppeals();

    expect(wrapper.find(".banner-red").text()).toContain("处理意见：兑换规则已公示，维持原结论");
    expect(wrapper.find(".banner-green").text()).toContain("申诉通过");
  });

  it("上拉加载第二页：追加且到底后 footer 显示已全部", async () => {
    const wrapper = await mountAppeals();
    expect(wrapper.find(".list-footer").text()).toBe("上拉加载更多");

    vi.mocked(fetchAppeals).mockResolvedValue(PAGE2 as never);
    for (const cb of hooks.registry.onReachBottom ?? []) cb();
    await flushPromises();

    expect(fetchAppeals).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
    expect(wrapper.findAll(".appeal-card")).toHaveLength(4);
    expect(wrapper.find(".list-footer").text()).toBe("已展示全部申诉记录");
  });

  it("空列表：显示暂无申诉记录空态", async () => {
    vi.mocked(fetchAppeals).mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 20 } } as never);
    const wrapper = await mountAppeals();

    // EmptyState 被 stub，标题是 prop 不进文本，断言空态容器存在
    expect(wrapper.find(".card-empty").exists()).toBe(true);
    expect(wrapper.find(".appeal-card").exists()).toBe(false);
  });
});
