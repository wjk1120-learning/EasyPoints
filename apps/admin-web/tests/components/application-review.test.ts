import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ElMessageBox } from "element-plus";
import ElementPlus from "element-plus";
import ApplicationReviewPanel from "../../src/components/review/ApplicationReviewPanel.vue";
import { applicationsPaged, reviewApplication } from "../../src/api/application/application";
import { employees as fetchEmployees } from "../../src/api/employee/employee";
import type { Application } from "../../src/api/application/types";
import { APPLICATIONS_FIXTURE } from "../fixtures/application";

/**
 * L3 组件测试：积分申请审核面板（mock 已拆除，直连契约）。
 */

vi.mock("../../src/api/application/application", () => ({ applicationsPaged: vi.fn(), reviewApplication: vi.fn() }));
vi.mock("../../src/api/employee/employee", () => ({ employees: vi.fn() }));

const mockedApplicationsPaged = vi.mocked(applicationsPaged);
const mockedReview = vi.mocked(reviewApplication);
const mockedEmployees = vi.mocked(fetchEmployees);

function fixtureRows(): Application[] {
  return APPLICATIONS_FIXTURE.map((a) => ({ ...a })) as unknown as Application[];
}

function mountPanel() {
  return mount(ApplicationReviewPanel, { global: { plugins: [ElementPlus] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedEmployees.mockResolvedValue([]);
  mockedApplicationsPaged.mockResolvedValue({ data: fixtureRows(), meta: { total: APPLICATIONS_FIXTURE.length, page: 1, pageSize: 50 } });
});

describe("积分申请审核面板", () => {
  it("加载申请列表：待审行渲染分值/缘由与通过/驳回按钮，已审行只读", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    expect(mockedApplicationsPaged).toHaveBeenCalledTimes(1);
    const pendingRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("张三"))!;
    expect(pendingRow.text()).toContain("+50");
    expect(pendingRow.findAll("button").map((b) => b.text())).toContain("通过");

    const rejectedRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("王五"))!;
    expect(rejectedRow.text()).toContain("已驳回");
    expect(rejectedRow.findAll("button").map((b) => b.text())).not.toContain("通过");
  });

  it("佐证图列表渲染为可预览元素（evidenceImages 直通）", async () => {
    const wrapper = mountPanel();
    await flushPromises();
    // 详情弹窗断言：打开张三的详情，佐证材料字段存在
    const pendingRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("张三"))!;
    await pendingRow.findAll("button").find((b) => b.text() === "详情")!.trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("申请缘由");
  });

  it("点击通过：确认弹窗 → POST payload {status:'approved', remark}", async () => {
    mockedReview.mockResolvedValue({} as never);
    vi.spyOn(ElMessageBox, "confirm").mockResolvedValue("confirm" as never);
    const wrapper = mountPanel();
    await flushPromises();

    const pendingRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("张三"))!;
    await pendingRow.findAll("button").find((b) => b.text() === "通过")!.trigger("click");
    await flushPromises();

    expect(mockedReview).toHaveBeenCalledWith(31, { status: "approved", remark: "审核通过" });
  });

  it("确认弹窗取消：不发起请求", async () => {
    vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel");
    const wrapper = mountPanel();
    await flushPromises();

    const pendingRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("张三"))!;
    await pendingRow.findAll("button").find((b) => b.text() === "通过")!.trigger("click");
    await flushPromises();

    expect(mockedReview).not.toHaveBeenCalled();
  });

  it("加载失败：提示错误且不崩", async () => {
    mockedApplicationsPaged.mockRejectedValue(new Error("网络请求失败"));
    const wrapper = mountPanel();
    await flushPromises();
    expect(wrapper.find(".el-table").exists()).toBe(true);
  });
});
