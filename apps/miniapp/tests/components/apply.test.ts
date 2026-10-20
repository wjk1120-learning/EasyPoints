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

async function mountApply() {
  const wrapper = mount(Apply, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
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
});
