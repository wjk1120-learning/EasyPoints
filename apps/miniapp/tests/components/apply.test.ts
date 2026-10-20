import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: any[]) => any>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb),
  onLoad: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onLoad ||= []).push(cb)
}));

vi.mock("../../api/application/application", () => ({
  fetchApplications: vi.fn(),
  createApplication: vi.fn(async () => ({ id: 21 }))
}));
vi.mock("../../api/upload/upload", () => ({
  uploadImage: vi.fn(async (path: string) => (path.endsWith("b.png") ? "/uploads/ev/mock-b.png" : "/uploads/ev/mock-a.png"))
}));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Apply from "../../pages/apply/index.vue";
import { fetchApplications, createApplication } from "../../api/application/application";
import { uploadImage } from "../../api/upload/upload";
import { homeBadges } from "../../utils/badge-state";

/** 契约 6.2 PointApplication 形状：reason 为输出字段名，待审 pending_review */
const APPLICATIONS_PAGED = {
  data: [
    { id: 21, points: 20, reason: "周末值守系统上线保障", status: "pending_review", statusText: "待审核", createdAt: "2026-10-14 10:00:00" },
    { id: 20, points: 10, reason: "提出流程优化建议并被采纳", status: "approved", statusText: "已通过", reviewRemark: null, createdAt: "2026-10-08 10:00:00", updatedAt: "2026-10-09 10:00:00" },
    { id: 19, points: 15, reason: "跨部门数据迁移支援", status: "rejected", statusText: "已驳回", reviewRemark: "贡献判定不符合同期任务范围", createdAt: "2026-10-05 10:00:00", updatedAt: "2026-10-06 10:00:00" }
  ],
  meta: { total: 3, page: 1, pageSize: 50 }
};

let stub!: ReturnType<typeof createUniStub>;

async function mountApply(query?: Record<string, string>) {
  const wrapper = mount(Apply, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
  // uni-app onLoad(query) 先于 onShow：有参数时先派发 onLoad 再触发 onShow（与真实时序一致）
  if (query) {
    for (const cb of hooks.registry.onLoad ?? []) cb(query);
  }
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("积分申请页（契约 6.1/6.2 / PRD 4.6）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    delete hooks.registry.onLoad;
    homeBadges.applications = 0;
    vi.mocked(fetchApplications).mockResolvedValue(APPLICATIONS_PAGED as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("我的申请列表按 PageResult 解析：状态 pill + 驳回原因读 reviewRemark", async () => {
    await mountApply();
    // 默认 form 视图，切到我的申请
    // mountApply 后 onShow 已跑 loadMine（rows 已填）

    const wrapper = await mountApply();
    await wrapper.findAll(".segmented .tab")[1].trigger("tap");
    await flushPromises();

    expect(fetchApplications).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
    const cards = wrapper.findAll(".apply-card");
    expect(cards).toHaveLength(3);
    expect(cards[0].find(".pill").text()).toBe("待审核"); // pending_review
    expect(cards[2].text()).toContain("贡献判定不符合同期任务范围");
    expect(wrapper.html()).not.toContain("接口尚未提供");
  });

  it("首页角标联动：加载我的申请后把待审核数写入共享状态（供快捷入口数字徽标）", async () => {
    await mountApply();

    expect(homeBadges.applications).toBe(1); // fixture 中仅 id=21 为 pending_review
  });

  it("未读徽标：仅已通过/已驳回显示（待审核不显示），点击后清零且持久化", async () => {
    const wrapper = await mountApply();

    // 切到我的申请列表（chips 只在 mine 视图渲染）
    await wrapper.findAll(".segmented .tab")[1].trigger("tap");
    await flushPromises();

    // 首次使用（无已读记录）：已通过/已驳回各 1 条未读；待审核/全部不显示徽标
    let chips = wrapper.findAll(".chips .chip");
    expect(chips[0].text()).toBe("全部");
    expect(chips[1].text()).toBe("待审核");
    expect(chips[2].text()).toBe("已通过1");
    expect(chips[3].text()).toBe("已驳回1");

    // 点击「已驳回」：提醒完成清零，「已通过」不受影响
    await chips[3].trigger("tap");
    await flushPromises();
    chips = wrapper.findAll(".chips .chip");
    expect(chips[3].text()).toBe("已驳回");
    expect(chips[2].text()).toBe("已通过1");

    // 已读持久化：重挂载（模拟退出再进）后「已驳回」仍为 0
    const again = await mountApply();
    await again.findAll(".segmented .tab")[1].trigger("tap");
    await flushPromises();
    chips = again.findAll(".chips .chip");
    expect(chips[3].text()).toBe("已驳回");
    expect(chips[2].text()).toBe("已通过1");
  });

  it("点「全部」= 已通过/已驳回一并已读", async () => {
    const wrapper = await mountApply();
    await wrapper.findAll(".segmented .tab")[1].trigger("tap");
    await flushPromises();

    await wrapper.findAll(".chips .chip")[0].trigger("tap");
    await flushPromises();

    const chips = wrapper.findAll(".chips .chip");
    expect(chips[2].text()).toBe("已通过");
    expect(chips[3].text()).toBe("已驳回");
  });

  it("提交申请带佐证图：先上传 2 张再 createApplication({ points, description, evidenceImages })", async () => {
    const wrapper = await mountApply();

    // 填表单
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("20");
    await wrapper.find("textarea").setValue("周末值守系统上线保障");

    // 选 2 张图
    (globalThis as unknown as { uni: { chooseImage: (o: { success: (r: { tempFilePaths: string[] }) => void }) => void } }).uni.chooseImage = (o) =>
      o.success({ tempFilePaths: ["tmp://a.png", "tmp://b.png"] });
    await wrapper.find(".image-add").trigger("tap");
    await flushPromises();

    await wrapper.find(".button").trigger("tap");
    await flushPromises();

    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect(createApplication).toHaveBeenCalledWith({
      points: 20,
      description: "周末值守系统上线保障",
      evidenceImages: ["/uploads/ev/mock-a.png", "/uploads/ev/mock-b.png"]
    });
    expect(stub.toasts).toContain("已提交，等待审核");
  });

  it("表单校验：空分值提交被拦截不发请求", async () => {
    const wrapper = await mountApply();

    await wrapper.find("textarea").setValue("只有描述没有分值");
    await wrapper.find(".button").trigger("tap");
    await flushPromises();

    expect(createApplication).not.toHaveBeenCalled();
  });

  it("被驳回申请直达申诉页：targetType=point_application", async () => {
    const wrapper = await mountApply();
    await wrapper.findAll(".segmented .tab")[1].trigger("tap");
    await flushPromises();

    const rejected = wrapper.findAll(".apply-card")[2];
    await rejected.find(".small-button").trigger("tap");

    expect(stub.navigations).toHaveLength(1);
    expect(stub.navigations[0]).toContain("/pages/appeal/index?targetType=point_application&targetId=19");
    expect(stub.navigations[0]).toContain(encodeURIComponent("跨部门数据迁移支援"));
  });

  it("view=mine 入参（消息申诉降级入口）：直达「我的申请」视图", async () => {
    const wrapper = mount(Apply, {
      global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
    });
    for (const cb of hooks.registry.onLoad ?? []) cb({ view: "mine" });
    for (const cb of hooks.registry.onShow ?? []) await cb();
    await flushPromises();

    expect(wrapper.findAll(".segmented .tab")[1].classes()).toContain("active");
  });

  it("首页入口带 filter=pending：默认落在待审核筛选（角标口径=待审核数）", async () => {
    const wrapper = await mountApply({ view: "mine", filter: "pending" });

    // 筛选落在待审核：chips 高亮第二项，列表只显示待审核记录
    const chips = wrapper.findAll(".chips .chip");
    expect(chips[1].classes()).toContain("chip-on");
    expect(chips[1].text()).toBe("待审核");
    const cards = wrapper.findAll(".apply-card");
    expect(cards).toHaveLength(1); // fixture 中仅 id=21 为 pending_review
    expect(cards[0].text()).toContain("周末值守系统上线保障");
  });
});
