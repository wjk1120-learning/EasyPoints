import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ElMessageBox } from "element-plus";
import ElementPlus from "element-plus";
import VoteManage from "../../src/views/VoteManage.vue";
import { closeVote, exportVoteStatsXlsx, voteStats, votesPaged } from "../../src/api/vote/vote";
import { employees as fetchEmployees } from "../../src/api/employee/employee";
import { tasksPaged } from "../../src/api/task/task";
import { applicationsPaged } from "../../src/api/application/application";
import { saveBlob } from "../../src/utils/request";
import type { Vote, VoteStats } from "../../src/api/vote/vote";
import { VOTES_FIXTURE, VOTE_STATS_FIXTURE } from "../fixtures/vote";

/**
 * L3 组件测试：投票管理页（列表/状态标签/统计抽屉/关闭/导出）。
 */

vi.mock("../../src/api/vote/vote", () => ({
  votesPaged: vi.fn(),
  createVote: vi.fn(),
  updateVote: vi.fn(),
  closeVote: vi.fn(),
  voteStats: vi.fn(),
  exportVoteStatsXlsx: vi.fn(),
}));
vi.mock("../../src/api/employee/employee", () => ({ employees: vi.fn() }));
vi.mock("../../src/api/task/task", () => ({ tasksPaged: vi.fn() }));
vi.mock("../../src/api/application/application", () => ({ applicationsPaged: vi.fn() }));

const mockedTasksPaged = vi.mocked(tasksPaged);
const mockedApplicationsPaged = vi.mocked(applicationsPaged);
vi.mock("../../src/utils/request", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils/request")>()),
  saveBlob: vi.fn(),
}));

const mockedVotesPaged = vi.mocked(votesPaged);
const mockedVoteStats = vi.mocked(voteStats);
const mockedClose = vi.mocked(closeVote);
const mockedExport = vi.mocked(exportVoteStatsXlsx);
const mockedEmployees = vi.mocked(fetchEmployees);
const mockedSaveBlob = vi.mocked(saveBlob);

const FAKE_BLOB = new Blob(["x"]);

function fixtureVotes(): Vote[] {
  return VOTES_FIXTURE.map((v) => ({ ...v })) as unknown as Vote[];
}

function mountPage() {
  return mount(VoteManage, { global: { plugins: [ElementPlus] }, attachTo: document.body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedEmployees.mockResolvedValue([]);
  mockedTasksPaged.mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 100 } });
  mockedApplicationsPaged.mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 100 } });
  mockedVotesPaged.mockResolvedValue({ data: fixtureVotes(), meta: { total: VOTES_FIXTURE.length, page: 1, pageSize: 200 } });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("投票管理页", () => {
  it("加载列表：派生状态标签（服务端 status 优先）与参与人数（participantCount 分母）", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(mockedVotesPaged).toHaveBeenCalledTimes(1);
    const text = wrapper.find(".el-table").text();
    expect(text).toContain("月度之星评选");
    expect(text).toContain("已结束"); // fixture status=ended
    expect(text).toContain("进行中"); // fixture status=in_progress
    expect(text).toContain("3/5"); // submittedCount/participantCount
    expect(text).toContain("普通调研"); // relatedLabel 为 null 时兜底
  });

  it("打开统计抽屉：参与率/选项票数/参与明细渲染（optionStats 含 optionId）", async () => {
    mockedVoteStats.mockResolvedValue(VOTE_STATS_FIXTURE as unknown as VoteStats);
    const wrapper = mountPage();
    await flushPromises();

    const row = wrapper.findAll(".el-table__row").find((r) => r.text().includes("月度之星评选"))!;
    await row.findAll("button").find((b) => b.text() === "统计")!.trigger("click");
    await flushPromises();
    await flushPromises();

    expect(mockedVoteStats).toHaveBeenCalledWith(11);
    const drawerText = document.body.textContent || "";
    expect(drawerText).toContain("60%"); // 参与率
    expect(drawerText).toContain("66.67"); // 选项票数百分比
    expect(drawerText).toContain("张三"); // 明细
  });

  it("手动关闭：确认弹窗 → POST close", async () => {
    mockedClose.mockResolvedValue({} as never);
    vi.spyOn(ElMessageBox, "confirm").mockResolvedValue("confirm" as never);
    const wrapper = mountPage();
    await flushPromises();

    const row = wrapper.findAll(".el-table__row").find((r) => r.text().includes("团建活动选址"))!;
    await row.findAll("button").find((b) => b.text() === "关闭")!.trigger("click");
    await flushPromises();

    expect(mockedClose).toHaveBeenCalledWith(12);
  });

  it("统计导出：后端生成文件，前端拼接文件名保存", async () => {
    mockedVoteStats.mockResolvedValue(VOTE_STATS_FIXTURE as unknown as VoteStats);
    mockedExport.mockResolvedValue(FAKE_BLOB);
    const wrapper = mountPage();
    await flushPromises();

    const row = wrapper.findAll(".el-table__row").find((r) => r.text().includes("月度之星评选"))!;
    await row.findAll("button").find((b) => b.text() === "统计")!.trigger("click");
    await flushPromises();
    await flushPromises();

    const exportBtn = ([...document.querySelectorAll(".el-drawer button")] as HTMLElement[]).find((b) => b.textContent?.includes("导出"));
    expect(exportBtn, "统计抽屉应有导出按钮").toBeTruthy();
    exportBtn!.click();
    await flushPromises();

    expect(mockedExport).toHaveBeenCalledWith(11);
    expect(mockedSaveBlob).toHaveBeenCalledWith(FAKE_BLOB, expect.stringMatching(/^投票统计-月度之星评选-.+\.xlsx$/));
  });

  it("加载失败：提示错误且不崩", async () => {
    mockedVotesPaged.mockRejectedValue(new Error("网络请求失败"));
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find(".el-table").exists()).toBe(true);
  });
});
