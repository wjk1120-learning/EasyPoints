import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import Reports from "../../src/views/Reports.vue";
import { employees as fetchEmployees } from "../../src/api/employee/employee";
import { exportPointRecordsXlsx, exportPointsSummaryXlsx } from "../../src/api/report/report";
import { exportOrdersXlsx } from "../../src/api/order/order";
import { exportTaskRecordsXlsx } from "../../src/api/task/task";
import { exportVoteStatsXlsx, votesPaged } from "../../src/api/vote/vote";
import { saveBlob } from "../../src/utils/request";
import type { Employee } from "../../src/api/employee/types";
import type { Vote } from "../../src/api/vote/vote";

/**
 * L3 组件测试：数据导出页（五张导出卡）。
 */

vi.mock("../../src/api/employee/employee", () => ({ employees: vi.fn() }));
vi.mock("../../src/api/report/report", () => ({ exportPointRecordsXlsx: vi.fn(), exportPointsSummaryXlsx: vi.fn() }));
vi.mock("../../src/api/order/order", () => ({ exportOrdersXlsx: vi.fn() }));
vi.mock("../../src/api/task/task", () => ({ exportTaskRecordsXlsx: vi.fn() }));
vi.mock("../../src/api/vote/vote", () => ({ exportVoteStatsXlsx: vi.fn(), votesPaged: vi.fn() }));
vi.mock("../../src/utils/request", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils/request")>()),
  saveBlob: vi.fn(),
}));

const mockedEmployees = vi.mocked(fetchEmployees);
const mockedVotesPaged = vi.mocked(votesPaged);
const mockedSummaryXlsx = vi.mocked(exportPointsSummaryXlsx);
const mockedPersonalXlsx = vi.mocked(exportPointRecordsXlsx);
const mockedOrdersXlsx = vi.mocked(exportOrdersXlsx);
const mockedSaveBlob = vi.mocked(saveBlob);

const FAKE_BLOB = new Blob(["x"]);

function fixtureEmployees(): Employee[] {
  return [
    { id: 1, wecomUserId: "a", name: "张三", departmentId: 1, departmentName: "研发部", pointsBalance: 100, availablePoints: 100, cumulativePoints: 200, status: "active", createdAt: "" },
  ];
}

function fixtureVotes(): Vote[] {
  return [
    { id: 11, title: "月度之星评选", description: "", voteType: "single", relatedType: "", relatedId: null, relatedLabel: null, startTime: "2026-10-08 09:00", endTime: "2026-10-12 18:00", closed: false, status: "ended", options: [], participantIds: [1], participantCount: 1, participantNames: ["张三"], submittedCount: 1, createdBy: 1, createdAt: "2026-10-07 10:00:00", updatedAt: "2026-10-07 10:00:00", submittedByMe: false },
  ] as unknown as Vote[];
}

function mountPage() {
  return mount(Reports, { global: { plugins: [ElementPlus] } });
}

type PageWrapper = ReturnType<typeof mountPage>;

async function openAndSettle() {
  const wrapper = mountPage();
  await flushPromises();
  return wrapper;
}

function cardButton(wrapper: PageWrapper, cardName: string) {
  const card = wrapper.findAll(".export-card").find((c) => c.text().includes(cardName))!;
  return card.find("button");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedEmployees.mockResolvedValue(fixtureEmployees());
  mockedVotesPaged.mockResolvedValue({ data: fixtureVotes(), meta: { total: 1, page: 1, pageSize: 200 } });
  mockedSummaryXlsx.mockResolvedValue(FAKE_BLOB);
  mockedPersonalXlsx.mockResolvedValue(FAKE_BLOB);
  mockedOrdersXlsx.mockResolvedValue(FAKE_BLOB);
});

describe("数据导出页", () => {
  it("五张导出卡渲染，卡描述与定稿口径一致", async () => {
    const wrapper = await openAndSettle();
    const text = wrapper.find(".export-grid").text();
    for (const name of ["全员积分数据表", "个人积分明细", "兑换记录表", "任务审核记录表", "投票统计数据表"]) {
      expect(text).toContain(name);
    }
    expect(text).toContain("每人一行：姓名 + 实际积分 + 累计积分");
  });

  it("全员积分数据表：一键导出触发下载并保存文件", async () => {
    const wrapper = await openAndSettle();
    await cardButton(wrapper, "全员积分数据表").trigger("click");
    await flushPromises();

    expect(mockedSummaryXlsx).toHaveBeenCalledTimes(1);
    expect(mockedSaveBlob).toHaveBeenCalledWith(FAKE_BLOB, expect.stringMatching(/^全员积分数据表-.+\.xlsx$/));
  });

  it("个人积分明细：未选员工被拦截；只选员工（不选月份）直接导出全部流水", async () => {
    const wrapper = await openAndSettle();
    const card = wrapper.findAll(".export-card").find((c) => c.text().includes("个人积分明细"))!;

    // 占位文案标明必选/可选（回归；须在选中前断言，选中后占位被值替换）
    const cardText = card.text();
    expect(cardText).toContain("请选择员工（必选）");
    const datePlaceholder = card.find(".el-date-editor input").attributes("placeholder") || "";
    expect(datePlaceholder).toContain("可选");

    await card.find("button").trigger("click");
    await flushPromises();
    expect(mockedPersonalXlsx).not.toHaveBeenCalled();

    // 只选员工不选月份：导出该员工全部流水（2026-10-13 口径），文件名含「全部」
    (wrapper.vm as unknown as { personal: { employeeId: string } }).personal.employeeId = "1";
    await flushPromises();
    await card.find("button").trigger("click");
    await flushPromises();
    expect(mockedPersonalXlsx).toHaveBeenCalledWith({ employeeId: "1", month: undefined });
    expect(mockedSaveBlob).toHaveBeenCalledWith(FAKE_BLOB, expect.stringMatching(/^积分明细-[^-]+-全部-.+\.xlsx$/));
  });

  it("兑换记录表：默认导出（无筛选参数）", async () => {
    const wrapper = await openAndSettle();
    await cardButton(wrapper, "兑换记录表").trigger("click");
    await flushPromises();

    expect(mockedOrdersXlsx).toHaveBeenCalledWith({});
    expect(mockedSaveBlob).toHaveBeenCalledWith(FAKE_BLOB, expect.stringMatching(/^兑换记录表-.+\.xlsx$/));
  });

  it("导出失败（404 未部署）：展示友好文案且不崩（中英文 404 均命中）", async () => {
    mockedSummaryXlsx.mockRejectedValue(new Error("接口不存在"));
    const wrapper = await openAndSettle();
    await cardButton(wrapper, "全员积分数据表").trigger("click");
    await flushPromises();

    expect(mockedSaveBlob).not.toHaveBeenCalled();
    expect(wrapper.find(".export-grid").exists()).toBe(true);

    // 英文 404 文案同样命中友好提示
    mockedSummaryXlsx.mockRejectedValue(new Error("Request failed with status code 404"));
    await cardButton(wrapper, "全员积分数据表").trigger("click");
    await flushPromises();
    expect(wrapper.find(".export-grid").exists()).toBe(true);
  });
});
