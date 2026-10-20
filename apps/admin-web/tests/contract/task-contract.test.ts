import { beforeEach, describe, expect, it } from "vitest";
import { createTask, deleteTask, publishTask, reviewTaskRecord, taskRecordsPaged, tasksPaged, unpublishTask, updateTask } from "../../src/api/task/task";
import { httpCalls, resetHttp, setResponse } from "../helpers/http";
import { TASK_RECORDS_FIXTURE, TASKS_FIXTURE } from "../fixtures/task";
import { baseResult } from "../fixtures/rule";

/** L2 契约测试：任务管理域（docs/Easy-Points-API.md 5.5~5.11） */

beforeEach(() => {
  resetHttp();
});

describe("契约：任务列表与 CRUD（文档 5.5~5.9）", () => {
  it("分页任务列表：status 筛选透传，行含 deadline/rewardPoints/status", async () => {
    setResponse(baseResult({ total: TASKS_FIXTURE.length, rows: [...TASKS_FIXTURE] }));

    const res = await tasksPaged({ page: 1, pageSize: 200, status: "published" });

    expect(httpCalls[0].method).toBe("get");
    expect(httpCalls[0].url).toBe("/admin/tasks");
    expect(httpCalls[0].params).toEqual({ page: 1, pageSize: 200, status: "published" });

    expect(res.data[0]).toMatchObject({ id: 3, name: "整理客户回访文档", rewardPoints: 100, deadline: "2026-10-31", status: "published" });
  });

  it("新建任务：POST /admin/tasks 请求体含 name/rewardPoints/deadline/requirement", async () => {
    setResponse(baseResult(TASKS_FIXTURE[0]));

    await createTask({ name: "整理客户回访文档", description: "汇总本季度客户回访记录", rewardPoints: 100, deadline: "2026-10-31", requirement: "输出文档" });

    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/tasks");
    expect(httpCalls[0].body).toMatchObject({ name: "整理客户回访文档", rewardPoints: 100, deadline: "2026-10-31" });
  });

  it("新建任务：status 可选入参透传（缺省下架由后端默认，编辑时后端忽略）", async () => {
    setResponse(baseResult(TASKS_FIXTURE[0]));

    await createTask({ name: "立即上架任务", description: "", rewardPoints: 50, deadline: "2026-10-31", requirement: "输出文档", status: "published" });

    expect(httpCalls[0].body).toMatchObject({ name: "立即上架任务", status: "published" });
  });

  it("编辑任务：PUT /admin/tasks/{id}", async () => {
    setResponse(baseResult(TASKS_FIXTURE[0]));
    await updateTask(3, { name: "改名", description: "", rewardPoints: 120, deadline: "2026-11-30", requirement: "要求" });
    expect(httpCalls[0].method).toBe("put");
    expect(httpCalls[0].url).toBe("/admin/tasks/3");
  });

  it("上架/下架/删除：POST 专用动作路由", async () => {
    setResponse(baseResult(TASKS_FIXTURE[0]));
    await publishTask(3);
    expect(httpCalls[0].url).toBe("/admin/tasks/3/publish");

    await unpublishTask(3);
    expect(httpCalls[1].url).toBe("/admin/tasks/3/unpublish");

    await deleteTask(3);
    expect(httpCalls[2].method).toBe("post");
    expect(httpCalls[2].url).toBe("/admin/tasks/3/delete"); // 文档契约路由（非 DELETE 方法）
  });
});

describe("契约：任务记录与审核（文档 5.10/5.11）", () => {
  it("记录分页：taskId/employeeId 筛选透传，行含 taskName/submissionText/submissionImages[]/submittedAt", async () => {
    setResponse(baseResult({ total: TASK_RECORDS_FIXTURE.length, rows: [...TASK_RECORDS_FIXTURE] }));

    const res = await taskRecordsPaged({ page: 1, pageSize: 50, taskId: 3 });

    expect(httpCalls[0].url).toBe("/admin/task-records");
    expect(httpCalls[0].params).toEqual({ page: 1, pageSize: 50, taskId: 3 });

    expect(res.data[0]).toMatchObject({
      id: 88,
      taskName: "整理客户回访文档",
      rewardPoints: 100,
      employeeName: "张三",
      submissionText: "文档已发送至部门邮箱，见附件截图",
      submissionImages: ["/uploads/ev/task-88-1.png"],
      submittedAt: "2026-10-09 15:30:00",
    });
  });

  it("成果审核：POST /admin/task-records/{id}/review 请求体 {status, remark}", async () => {
    setResponse(baseResult({ ...TASK_RECORDS_FIXTURE[0], status: "approved" }));

    await reviewTaskRecord(88, { status: "approved", remark: "审核通过" });

    expect(httpCalls[0].method).toBe("post");
    expect(httpCalls[0].url).toBe("/admin/task-records/88/review");
    expect(httpCalls[0].body).toEqual({ status: "approved", remark: "审核通过" });
  });

  it("驳回备注为空：HTTP 400 + msg 透传（文档 5.11 错误场景）", async () => {
    setResponse({ code: 0, msg: "处理备注不能为空", data: null }, 400);
    await expect(reviewTaskRecord(88, { status: "rejected", remark: "" })).rejects.toThrow("处理备注不能为空");
  });

  it("非待审状态审核：HTTP 400 状态文案透传", async () => {
    setResponse({ code: 0, msg: "该任务当前状态不可审核", data: null }, 400);
    await expect(reviewTaskRecord(87, { status: "approved", remark: "x" })).rejects.toThrow("该任务当前状态不可审核");
  });
});
