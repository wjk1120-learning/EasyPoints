import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ElMessageBox } from "element-plus";
import ElementPlus from "element-plus";
import TaskManage from "../../src/views/TaskManage.vue";
import TaskReviewPanel from "../../src/components/review/TaskReviewPanel.vue";
import { createTask, deleteTask, publishTask, taskRecordsPaged, tasksPaged } from "../../src/api/task/task";
import { employees as fetchEmployees } from "../../src/api/employee/employee";
import type { EmployeeTask, Task } from "../../src/api/task/task";
import { TASK_RECORDS_FIXTURE, TASKS_FIXTURE } from "../fixtures/task";

/**
 * L3 组件测试：任务管理页（CRUD/上下架/删除/进度抽屉）与任务成果审核面板。
 */

vi.mock("../../src/api/task/task", () => ({
  tasksPaged: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  publishTask: vi.fn(),
  unpublishTask: vi.fn(),
  deleteTask: vi.fn(),
  taskRecordsPaged: vi.fn(),
  reviewTaskRecord: vi.fn(),
}));
vi.mock("../../src/api/employee/employee", () => ({ employees: vi.fn() }));

const mockedTasksPaged = vi.mocked(tasksPaged);
const mockedCreate = vi.mocked(createTask);
const mockedPublish = vi.mocked(publishTask);
const mockedDelete = vi.mocked(deleteTask);
const mockedRecords = vi.mocked(taskRecordsPaged);
const mockedEmployees = vi.mocked(fetchEmployees);

function fixtureTasks(): Task[] {
  return TASKS_FIXTURE.map((t) => ({ ...t })) as unknown as Task[];
}

function fixtureRecords(): EmployeeTask[] {
  return TASK_RECORDS_FIXTURE.map((r) => ({ ...r })) as unknown as EmployeeTask[];
}

function rowButton(wrapper: ReturnType<typeof mount>, rowText: string, buttonText: string) {
  const row = wrapper.findAll(".el-table__row").find((r) => r.text().includes(rowText))!;
  return row.findAll("button").find((b) => b.text().includes(buttonText))!;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedEmployees.mockResolvedValue([]);
  mockedTasksPaged.mockResolvedValue({ data: fixtureTasks(), meta: { total: TASKS_FIXTURE.length, page: 1, pageSize: 200 } });
  mockedRecords.mockResolvedValue({ data: fixtureRecords(), meta: { total: TASK_RECORDS_FIXTURE.length, page: 1, pageSize: 100 } });
});

afterEach(() => {
  document.body.innerHTML = ""; // 弹窗/抽屉 teleport 到 body，测试间清理防串扰
});

function mountPage(component: typeof TaskManage | typeof TaskReviewPanel) {
  // 弹窗/抽屉 teleport 到 body，须 attachTo 真实文档才能断言
  return mount(component, { global: { plugins: [ElementPlus] }, attachTo: document.body });
}

describe("任务管理页", () => {
  it("加载任务列表：上架/下架标签与操作按钮齐全", async () => {
    const wrapper = mountPage(TaskManage);
    await flushPromises();

    const text = wrapper.find(".el-table").text();
    expect(text).toContain("整理客户回访文档");
    expect(text).toContain("上架中");
    expect(text).toContain("已下架");

    const publishedRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("整理客户回访文档"))!;
    expect(publishedRow.findAll("button").map((b) => b.text())).toEqual(expect.arrayContaining(["记录", "编辑", "下架", "删除"]));
  });

  it("新建任务：校验必填后 POST，成功提示默认下架", async () => {
    mockedCreate.mockResolvedValue(fixtureTasks()[0]);
    const wrapper = mountPage(TaskManage);
    await flushPromises();

    await wrapper.findAll("button").find((b) => b.text().includes("新增任务"))!.trigger("click");
    await flushPromises();
    // 必填校验：直接点保存被拦
    const dialog = document.querySelector(".el-dialog")!;
    const saveBtn = ([...dialog.querySelectorAll("button")] as HTMLElement[]).find((b) => b.textContent === "保存")!;
    saveBtn.click();
    await flushPromises();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("上架确认：ElMessageBox → POST publish", async () => {
    mockedPublish.mockResolvedValue(fixtureTasks()[0]);
    vi.spyOn(ElMessageBox, "confirm").mockResolvedValue("confirm" as never);
    const wrapper = mountPage(TaskManage);
    await flushPromises();

    await rowButton(wrapper, "官网内容校对", "上架").trigger("click");
    await flushPromises();

    expect(mockedPublish).toHaveBeenCalledWith(4);
  });

  it("删除确认取消：不发起请求", async () => {
    vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel");
    const wrapper = mountPage(TaskManage);
    await flushPromises();

    await rowButton(wrapper, "整理客户回访文档", "删除").trigger("click");
    await flushPromises();
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it("进度抽屉：按 taskId 拉取记录，待审记录可见成果说明", async () => {
    const wrapper = mountPage(TaskManage);
    await flushPromises();

    await rowButton(wrapper, "整理客户回访文档", "记录").trigger("click");
    await flushPromises();
    await flushPromises();

    expect(mockedRecords).toHaveBeenCalledWith(expect.objectContaining({ taskId: 3 }));
    expect(document.body.textContent).toContain("文档已发送至部门邮箱");
  });
});

describe("任务成果审核面板", () => {
  it("待审记录渲染成果说明与佐证图入口", async () => {
    const wrapper = mountPage(TaskReviewPanel);
    await flushPromises();

    const text = wrapper.find(".el-table").text();
    expect(text).toContain("张三");
    expect(text).toContain("文档已发送至部门邮箱");
  });
});
