import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  registry: {} as Record<string, Array<(...args: any[]) => any>>
}));

vi.mock("@dcloudio/uni-app", () => ({
  onShow: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onShow ||= []).push(cb),
  onPullDownRefresh: (cb: (...args: unknown[]) => unknown) => (hooks.registry.onPullDownRefresh ||= []).push(cb)
}));

vi.mock("../../api/task/task", () => ({ fetchTasks: vi.fn(), claimTask: vi.fn(async () => ({})), submitTask: vi.fn(async () => ({})), fetchTaskClaims: vi.fn() }));
vi.mock("../../api/upload/upload", () => ({ uploadImage: vi.fn(async (path: string) => (path.endsWith("b.png") ? "/uploads/ev/mock-b.png" : "/uploads/ev/mock-a.png")) }));

import { flushPromises, mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import Tasks from "../../pages/tasks/index.vue";
import { fetchTasks, claimTask, submitTask, fetchTaskClaims } from "../../api/task/task";
import { uploadImage } from "../../api/upload/upload";

/** 契约 5.1 Task 形状：status 为个人视角状态 + statusText/title 别名 */
/** fetchTasks 归一后的 Paged 形状（requestPaged 已把 PageResult{total,rows} 转为 {data,meta}） */
const TASKS_PAGED = {
  data: [
    { id: 7, name: "整理客户回访文档", title: "整理客户回访文档", description: "整理 3 家重点客户回访纪要", rewardPoints: 20, deadline: "2026-10-17", status: "open", statusText: "可领取", claimedByMe: false },
    { id: 8, name: "知识库常见问题整理", title: "知识库常见问题整理", description: "整理本岗位常见问题 20 条", rewardPoints: 10, status: "in_progress", statusText: "进行中", claimedByMe: true },
    { id: 9, name: "调研报告撰写", title: "调研报告撰写", description: "输出行业调研报告", rewardPoints: 15, status: "rejected", statusText: "已驳回", claimedByMe: true, updatedAt: "2026-10-10 10:00:00" }
  ],
  meta: { total: 3, page: 1, pageSize: 50 }
};

let stub!: ReturnType<typeof createUniStub>;

async function mountTasks() {
  const wrapper = mount(Tasks, {
    global: { stubs: { NavBar: true, AppTabBar: true, AppIcon: true, EmptyState: true } }
  });
  for (const cb of hooks.registry.onShow ?? []) await cb();
  await flushPromises();
  return wrapper;
}

describe("任务大厅（契约 5.1~5.2b / PRD 4.3）", () => {
  beforeEach(() => {
    stub = createUniStub();
    vi.clearAllMocks();
    delete hooks.registry.onShow;
    delete hooks.registry.onReachBottom;
    vi.mocked(fetchTasks).mockResolvedValue(TASKS_PAGED as never);
    vi.mocked(fetchTaskClaims).mockResolvedValue({
      data: [{ id: 55, taskId: 9, status: "rejected", taskName: "调研报告撰写", reviewRemark: "报告深度不足" }],
      meta: { total: 1, page: 1, pageSize: 50 }
    } as never);
  });
  afterEach(() => {
    delete (globalThis as unknown as { uni?: unknown }).uni;
  });

  it("列表按 PageResult 解析：3 行渲染 + 不再有「接口尚未提供」文案", async () => {
    const wrapper = await mountTasks();

    expect(fetchTasks).toHaveBeenCalledWith("all", { page: 1, pageSize: 50 });
    expect(wrapper.findAll(".task-card")).toHaveLength(3);
    expect(wrapper.find(".task-title").text()).toBe("整理客户回访文档");
    expect(wrapper.html()).not.toContain("接口尚未提供");
  });

  it("领取任务：claimTask(7) 后刷新列表", async () => {
    const wrapper = await mountTasks();

    await wrapper.find(".task-button").trigger("tap");
    await flushPromises();

    expect(claimTask).toHaveBeenCalledWith(7);
    expect(stub.toasts).toContain("已领取");
    expect(fetchTasks).toHaveBeenCalledTimes(2);
  });

  it("提交成果带佐证图：先上传 2 张再提交 evidenceImages", async () => {
    const wrapper = await mountTasks();

    // 切「我的任务」→ 找进行中任务的「提交成果」
    await wrapper.findAll(".segmented .tab")[1].trigger("tap");
    await flushPromises();
    const running = wrapper.findAll(".task-card").find((c) => c.text().includes("知识库"));
    await running!.find(".small-button").trigger("tap"); // 提交成果
    await flushPromises();

    // 填说明 + 选 2 张图（覆盖 uni.chooseImage 成功分支）
    wrapper.find(".textarea").setValue("已完成 20 条整理并录入知识库");
    (globalThis as unknown as { uni: { chooseImage: (o: { success: (r: { tempFilePaths: string[] }) => void }) => void } }).uni.chooseImage = (o) =>
      o.success({ tempFilePaths: ["tmp://a.png", "tmp://b.png"] });
    await wrapper.find(".image-add").trigger("tap");
    await flushPromises();
    expect(wrapper.findAll(".image-item")).toHaveLength(2);

    await wrapper.find(".submit-button").trigger("tap");
    await flushPromises();

    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect(submitTask).toHaveBeenCalledWith(8, "已完成 20 条整理并录入知识库", ["/uploads/ev/mock-a.png", "/uploads/ev/mock-b.png"]);
    expect(stub.toasts).toContain("已提交，等待审核");
  });

  it("空成果说明：拦截不发请求", async () => {
    const wrapper = await mountTasks();
    await wrapper.findAll(".segmented .tab")[1].trigger("tap");
    await flushPromises();
    const running = wrapper.findAll(".task-card").find((c) => c.text().includes("知识库"));
    await running!.find(".small-button").trigger("tap");
    await flushPromises();

    await wrapper.find(".submit-button").trigger("tap");
    await flushPromises();

    expect(submitTask).not.toHaveBeenCalled();
    expect(stub.toasts).toContain("请填写成果说明");
  });

  it("被驳回任务「发起申诉」直达申诉页：targetId 换算为领取记录主键", async () => {
    const wrapper = await mountTasks();
    await wrapper.findAll(".segmented .tab")[1].trigger("tap");
    await flushPromises();
    const rejected = wrapper.findAll(".task-card").find((c) => c.text().includes("调研报告"));
    await rejected!.find(".small-button.danger").trigger("tap");
    await flushPromises();

    // targetId 必须是 task_claims 主键（后端按它校验本人+已驳回），不是任务 ID
    expect(fetchTaskClaims).toHaveBeenCalledWith("rejected", { page: 1, pageSize: 50 });
    expect(stub.navigations).toHaveLength(1);
    expect(stub.navigations[0]).toContain("/pages/appeal/index?targetType=task_claim&targetId=55");
    expect(stub.navigations[0]).toContain(encodeURIComponent("调研报告撰写"));
  });
});
