import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import AppealReviewPanel from "../../src/components/review/AppealReviewPanel.vue";
import { appealsPaged, reviewAppeal } from "../../src/api/appeal/appeal";
import { employees as fetchEmployees } from "../../src/api/employee/employee";
import type { Appeal } from "../../src/api/appeal/types";
import { APPEALS_FIXTURE, APPEAL_REJECTED_FIXTURE } from "../fixtures/appeal";

/**
 * L3 组件测试：申诉处理面板（一级三态 + targetSummary 上下文 + 佐证图解析）。
 */

vi.mock("../../src/api/appeal/appeal", () => ({ appealsPaged: vi.fn(), reviewAppeal: vi.fn() }));
vi.mock("../../src/api/employee/employee", () => ({ employees: vi.fn() }));

const mockedAppealsPaged = vi.mocked(appealsPaged);
const mockedReview = vi.mocked(reviewAppeal);
const mockedEmployees = vi.mocked(fetchEmployees);

function fixtureRows(): Appeal[] {
  return [...APPEALS_FIXTURE, APPEAL_REJECTED_FIXTURE].map((a) => ({ ...a })) as unknown as Appeal[];
}

function mountPanel() {
  return mount(AppealReviewPanel, { global: { plugins: [ElementPlus] }, attachTo: document.body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedEmployees.mockResolvedValue([]);
  mockedAppealsPaged.mockResolvedValue({ data: fixtureRows(), meta: { total: 3, page: 1, pageSize: 50 } });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("申诉处理面板", () => {
  it("加载列表：待审行有处理按钮、已驳进行只读，事件列展示 targetSummary 摘要", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    expect(mockedAppealsPaged).toHaveBeenCalledTimes(1);
    const rows = wrapper.findAll(".el-table__row");
    expect(rows).toHaveLength(3);

    const taskAppealRow = rows.find((r) => r.text().includes("李四"))!;
    // 事件列：无 pointRecord 时用 targetSummary.title · content
    expect(taskAppealRow.text()).toContain("整理客户回访文档 · 初步整理稿");
    expect(taskAppealRow.findAll("button").map((b) => b.text())).toContain("处理");

    const rejectedRow = rows.find((r) => r.text().includes("维持原判"))!;
    expect(rejectedRow.findAll("button").map((b) => b.text())).not.toContain("处理");
  });

  it("详情弹窗：展示申诉目标/原记录内容/当时审核备注/佐证图（JSON 字符串解析）", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    const row = wrapper.findAll(".el-table__row").find((r) => r.text().includes("李四"))!;
    await row.findAll("button").find((b) => b.text() === "详情")!.trigger("click");
    await flushPromises();

    const dialogText = document.querySelector(".el-dialog")?.textContent || "";
    expect(dialogText).toContain("整理客户回访文档"); // 申诉目标（targetSummary.title）
    expect(dialogText).toContain("缺少回访记录明细"); // 当时审核备注
    expect(dialogText).toContain("申诉原因");
  });

  it("旧数据无 targetSummary（过渡期）：非流水类申诉详情给占位提示，流水类不显示该行", async () => {
    const legacy = { ...fixtureRows()[1], targetSummary: undefined } as unknown as Appeal;
    const legacyPointRecord = { ...fixtureRows()[0], targetSummary: undefined } as unknown as Appeal;
    mockedAppealsPaged.mockResolvedValue({ data: [legacy, legacyPointRecord], meta: { total: 2, page: 1, pageSize: 50 } });
    const wrapper = mountPanel();
    await flushPromises();

    const taskRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("李四"))!;
    await taskRow.findAll("button").find((b) => b.text() === "详情")!.trigger("click");
    await flushPromises();
    expect(document.querySelector(".el-dialog")?.textContent).toContain("当前后端未返回");
    await (wrapper.find(".el-dialog__headerbtn").element as HTMLElement)?.click?.();
    document.body.innerHTML = "";

    const pointRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("张三"))!;
    await pointRow.findAll("button").find((b) => b.text() === "详情")!.trigger("click");
    await flushPromises();
    const pointDialogText = document.querySelector(".el-dialog")?.textContent || "";
    expect(pointDialogText).not.toContain("当时审核备注"); // 流水类契约即无此字段
  });

  it("处理弹窗提交：payload 仅 {status:'approved', resultRemark}（无 stage）", async () => {
    mockedReview.mockResolvedValue({} as never);
    const wrapper = mountPanel();
    await flushPromises();

    const row = wrapper.findAll(".el-table__row").find((r) => r.text().includes("张三"))!;
    await row.findAll("button").find((b) => b.text() === "处理")!.trigger("click");
    await flushPromises();

    const dialog = document.querySelector(".el-dialog")!;
    const textarea = dialog.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "申诉成立，予以补分";
    textarea.dispatchEvent(new Event("input"));
    await flushPromises();

    const submitBtn = ([...dialog.querySelectorAll("button")] as HTMLElement[]).find((b) => b.textContent === "提交")!;
    submitBtn.click();
    await flushPromises();

    expect(mockedReview).toHaveBeenCalledTimes(1);
    const [id, payload] = mockedReview.mock.calls[0];
    expect(id).toBe(21);
    expect(payload).toEqual({ status: "approved", resultRemark: "申诉成立，予以补分" });
  });

  it("处理备注为空：前端拦截不发请求（备注底线）", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    const row = wrapper.findAll(".el-table__row").find((r) => r.text().includes("张三"))!;
    await row.findAll("button").find((b) => b.text() === "处理")!.trigger("click");
    await flushPromises();

    const dialog = document.querySelector(".el-dialog")!;
    const submitBtn = ([...dialog.querySelectorAll("button")] as HTMLElement[]).find((b) => b.textContent === "提交")!;
    submitBtn.click();
    await flushPromises();

    expect(mockedReview).not.toHaveBeenCalled();
  });

  it("加载失败：提示错误且不崩（回归：原来缺 catch）", async () => {
    mockedAppealsPaged.mockRejectedValue(new Error("网络请求失败"));
    const wrapper = mountPanel();
    await flushPromises();
    expect(wrapper.find(".el-table").exists()).toBe(true);
  });
});
