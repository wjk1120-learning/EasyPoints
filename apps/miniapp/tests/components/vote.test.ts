import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(query?: Record<string, string>) => void>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onLoad: (cb: (query?: Record<string, string>) => void) => (hooks.registry.onLoad ||= []).push(cb)
}));

vi.mock("../../api/vote/vote", () => ({ fetchVote: vi.fn(), submitBallot: vi.fn() }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Vote from "../../pages/vote/index.vue";
import { fetchVote, submitBallot } from "../../api/vote/vote";

/** 契约 9.8 VoteDetail 形状：options[].text 与 selectedOptionIds 为小程序契约字段名 */
const DETAIL = {
  id: 12,
  title: "Q4 团建方案评选",
  description: "选出大家心仪的团建方案",
  mode: "single",
  submitted: false,
  status: "active",
  statusText: "进行中",
  deadline: "2026-10-20 18:00",
  relatedLabel: "任务 #7 · 整理客户回访文档",
  options: [
    { id: 101, text: "方案 A：户外拓展" },
    { id: 102, text: "方案 B：聚餐" },
    { id: 103, text: "方案 C：观影" }
  ]
};

let stub!: ReturnType<typeof createUniStub>;

async function mountVote(id: string, detail?: unknown) {
  if (detail !== undefined) vi.mocked(fetchVote).mockResolvedValue(detail as never);
  const wrapper = mount(Vote, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true } }
  });
  for (const cb of hooks.registry.onLoad ?? []) cb({ id });
  await flushPromises();
  return wrapper;
}

describe("投票详情（契约 9.8/9.9 / PRD 4.7）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onLoad;
    vi.mocked(submitBallot).mockResolvedValue({ ...DETAIL, submitted: true, selectedOptionIds: [101] } as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("单选全流程：选项渲染 → 勾选 → 提交 ballots → 回显已锁定", async () => {
    const wrapper = await mountVote("12", DETAIL);

    const options = wrapper.findAll(".option");
    expect(options).toHaveLength(3);
    expect(wrapper.text()).toContain("关联：任务 #7 · 整理客户回访文档");

    await options[0].trigger("tap");
    await wrapper.find(".button").trigger("tap");
    await flushPromises();

    expect(submitBallot).toHaveBeenCalledWith("12", ["101"]);
    expect(stub.toasts).toContain("已完成投票");
    expect(wrapper.find(".button").text()).toBe("已完成投票");
    expect(wrapper.findAll(".option")[0].classes()).toContain("on");
  });

  it("已提交回显：selectedOptionIds 预选中且锁定，不再发提交请求", async () => {
    const wrapper = await mountVote("12", { ...DETAIL, submitted: true, selectedOptionIds: [102] });

    expect(wrapper.findAll(".option")[1].classes()).toContain("on");
    await wrapper.find(".button").trigger("tap");

    expect(submitBallot).not.toHaveBeenCalled();
    expect(wrapper.find(".button").text()).toBe("已完成投票");
  });

  it("多选：可勾多个也可取消，提交带全部勾选项", async () => {
    const wrapper = await mountVote("12", { ...DETAIL, mode: "multiple", multiple: true });

    const options = wrapper.findAll(".option");
    await options[0].trigger("tap");
    await options[1].trigger("tap");
    await options[0].trigger("tap");
    await wrapper.find(".button").trigger("tap");
    await flushPromises();

    expect(submitBallot).toHaveBeenCalledWith("12", ["102"]);
    expect(wrapper.findAll(".option")[0].classes()).not.toContain("on");
    expect(wrapper.findAll(".option")[1].classes()).toContain("on");
  });

  it("非参与者 404：展示后端「投票不存在」原文", async () => {
    vi.mocked(fetchVote).mockRejectedValue(new Error("投票不存在") as never);
    const wrapper = await mountVote("99");

    expect(wrapper.text()).toContain("投票不存在");
    expect(wrapper.find(".option").exists()).toBe(false);
  });
});
