import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: any[]) => any>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb)
}));

vi.mock("../../api/rule/rule", () => ({ fetchRules: vi.fn() }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Rules from "../../pages/rules/index.vue";
import { fetchRules } from "../../api/rule/rule";

/** 契约 8.7：content 为管理端富文本 HTML，rich-text 渲染（不再按分号切行） */
const RULES = [
  {
    id: 1,
    title: "积分获取规则",
    content: "<p>1. 任务奖励按审核通过的分值入账</p><p><strong>2. 申诉期间对应积分冻结</strong></p>",
    version: 3,
    updatedAt: "2026-10-10 15:00:00"
  },
  { id: 2, title: "积分兑换规则", content: "<p>兑换提交后积分实时扣减</p>", version: 1, updatedAt: "2026-09-01 09:00:00" }
];

async function mountRules() {
  const wrapper = mount(Rules, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("规则中心（契约 8.7 / PRD 4.9）", () => {
  beforeEach(() => {
    createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    vi.mocked(fetchRules).mockResolvedValue(JSON.parse(JSON.stringify(RULES)) as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("规则卡渲染：HTML 原样交给 rich-text（标签不再当文字显示）", async () => {
    const wrapper = await mountRules();

    expect(fetchRules).toHaveBeenCalled();
    const cards = wrapper.findAll(".rule-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].text()).toContain("积分获取规则");
    expect(cards[0].text()).toContain("V3 · 2026-10-10 更新");

    const rich = wrapper.findAll("rich-text");
    expect(rich).toHaveLength(2);
    expect(String(rich[0].attributes("nodes"))).toContain("<strong>");
    expect(String(rich[1].attributes("nodes"))).toContain("<p>");
  });

  it("折叠/展开：默认展开，点头部收起正文再点恢复", async () => {
    const wrapper = await mountRules();
    expect(wrapper.findAll("rich-text")).toHaveLength(2);

    await wrapper.find(".rule-card .press").trigger("tap");
    expect(wrapper.findAll("rich-text")).toHaveLength(1);

    await wrapper.find(".rule-card .press").trigger("tap");
    expect(wrapper.findAll("rich-text")).toHaveLength(2);
  });

  it("空列表：显示暂无规则空态", async () => {
    vi.mocked(fetchRules).mockResolvedValue([] as never);
    const wrapper = await mountRules();

    expect(wrapper.find(".card-empty").exists()).toBe(true);
    expect(wrapper.find(".rule-card").exists()).toBe(false);
  });
});
