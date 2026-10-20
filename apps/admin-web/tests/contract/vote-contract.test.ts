import { beforeEach, describe, expect, it } from "vitest";
import { closeVote, createVote, updateVote, voteStats, votesPaged } from "../../src/api/vote/vote";
import { deriveVoteStatus } from "../../src/utils/vote";
import { httpCalls, resetHttp, setResponse } from "../helpers/http";
import { VOTES_FIXTURE, VOTE_STATS_FIXTURE } from "../fixtures/vote";
import { baseResult } from "../fixtures/rule";

/** L2 契约测试：投票管理域（docs/Easy-Points-API.md 9.1~9.6） */

beforeEach(() => {
  resetHttp();
});

describe("契约：投票列表（文档 9.1）", () => {
  it("分页查询：title/status 筛选透传，行含 participantIds/participantCount/status/options[]", async () => {
    setResponse(baseResult({ total: VOTES_FIXTURE.length, rows: [...VOTES_FIXTURE] }));

    const res = await votesPaged({ page: 1, pageSize: 200, title: "月度", status: "ended" });

    expect(httpCalls[0].method).toBe("get");
    expect(httpCalls[0].url).toBe("/admin/votes");
    expect(httpCalls[0].params).toEqual({ page: 1, pageSize: 200, title: "月度", status: "ended" });

    expect(res.data[0]).toMatchObject({
      id: 11,
      title: "月度之星评选",
      participantIds: [1, 2, 3, 4, 5],
      participantCount: 5,
      submittedCount: 3,
      status: "ended",
    });
    expect(res.data[0].options).toEqual([{ id: 101, text: "张三" }, { id: 102, text: "李四" }]);
  });
});

describe("契约：新建投票（文档 9.2）", () => {
  it("POST /admin/votes：options 为纯字符串数组，participantIds 必传，不回传 participantNames/relatedLabel", async () => {
    setResponse(baseResult(VOTES_FIXTURE[0]));

    await createVote({
      title: "月度之星评选",
      description: "本月之星投票",
      relatedType: "",
      voteType: "single",
      options: ["张三", "李四"],
      startTime: "2026-10-08 09:00",
      endTime: "2026-10-12 18:00",
      participantIds: [1, 2, 3, 4, 5],
    });

    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/votes");
    expect(httpCalls[0].body).toEqual({
      title: "月度之星评选",
      description: "本月之星投票",
      relatedType: "",
      voteType: "single",
      options: ["张三", "李四"],
      startTime: "2026-10-08 09:00",
      endTime: "2026-10-12 18:00",
      participantIds: [1, 2, 3, 4, 5],
    });
  });
});

describe("契约：编辑/关闭（文档 9.3/9.4）", () => {
  it("编辑：POST {id}/update（仅未开始可编辑）", async () => {
    setResponse(baseResult(VOTES_FIXTURE[0]));
    await updateVote(11, {
      title: "改题", description: "", relatedType: "", voteType: "single",
      options: ["甲", "乙"], startTime: "2026-11-01 09:00", endTime: "2026-11-05 18:00", participantIds: [1],
    });
    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/votes/11/update");
  });

  it("手动关闭：POST {id}/close；已结束 400 文案透传", async () => {
    setResponse(baseResult(VOTES_FIXTURE[0]));
    await closeVote(11);
    expect(httpCalls[0].url).toBe("/admin/votes/11/close");

    setResponse({ code: 0, msg: "投票已结束，无需关闭", data: null }, 400);
    await expect(closeVote(11)).rejects.toThrow("投票已结束，无需关闭");
  });
});

describe("契约：投票统计（文档 9.5）", () => {
  it("GET {id}/stats：optionStats 含 optionId/text/votes/percent，details 含 selectedTexts[]", async () => {
    setResponse(baseResult(VOTE_STATS_FIXTURE));

    const stats = await voteStats(11);

    expect(httpCalls[0].url).toBe("/admin/votes/11/stats");
    expect(stats).toMatchObject({ totalParticipants: 5, submittedCount: 3, participationRate: 60 });
    expect(stats.optionStats[0]).toEqual({ optionId: 101, text: "张三", votes: 2, percent: 66.67 });
    expect(stats.details[0]).toMatchObject({ employeeName: "张三", selectedTexts: ["张三"] });
  });

  it("未开始查统计：HTTP 400 文案透传", async () => {
    setResponse({ code: 0, msg: "投票未开始", data: null }, 400);
    await expect(voteStats(13)).rejects.toThrow("投票未开始");
  });
});

describe("状态推导（9.1 服务端 status 优先）", () => {
  it("行带服务端 status 时直接采用，不再本地推导", () => {
    const vote = { ...VOTES_FIXTURE[0], status: "in_progress" as const }; // 即使本地时间已过 endTime
    expect(deriveVoteStatus(vote)).toBe("in_progress");
  });

  it("旧行无 status 时按时间/closed 推导", () => {
    const { status: _s, closed: _c, ...legacy } = VOTES_FIXTURE[0];
    expect(deriveVoteStatus({ ...legacy, closed: false })).toBe("ended"); // endTime 2026-10-12 已过
    expect(deriveVoteStatus({ ...legacy, closed: true })).toBe("ended");
  });
});
