import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import EmployeePoints from "../../src/views/EmployeePoints.vue";
import { employees as fetchEmployees } from "../../src/api/employee/employee";
import type { Employee } from "../../src/api/employee/types";
import { EMPLOYEES_FIXTURE } from "../fixtures/employee";

/**
 * L3 组件测试：员工积分页（employee 域消费方）。
 * 挂载仅触发 employees()；points/report/wecom 域为交互触发，不 mock 不请求。
 */

vi.mock("../../src/api/employee/employee", () => ({
  employees: vi.fn(),
}));

const mockedEmployees = vi.mocked(fetchEmployees);

function fixtureList(): Employee[] {
  return EMPLOYEES_FIXTURE.map((e) => ({ ...e }));
}

function mountPage() {
  return mount(EmployeePoints, { global: { plugins: [ElementPlus] } });
}

/** 表格首列员工 ID 的顺序（反映 availablePoints 降序排序） */
function rowIds(wrapper: ReturnType<typeof mountPage>): string[] {
  return wrapper.findAll(".el-table__row").map((row) => row.text().match(/\b(\d+)\b/)?.[1] || "");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedEmployees.mockResolvedValue(fixtureList());
});

describe("员工积分页", () => {
  it("挂载即拉取员工列表，表格渲染姓名与双积分列", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(mockedEmployees).toHaveBeenCalledTimes(1);
    const text = wrapper.find(".el-table").text();
    for (const name of ["张三", "李四", "王五", "赵六", "孙八"]) {
      expect(text).toContain(name);
    }
    expect(text).toContain("1520"); // 王五可用积分
    expect(text).toContain("2980"); // 王五累计积分
  });

  it("列表按可用积分降序展示（fixture 故意乱序投喂）", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(rowIds(wrapper)).toEqual(["3", "1", "2", "4", "6"]); // 王五1520 > 张三1189 > 李四860 > 赵六430 > 孙八0
  });

  it("搜索框过滤：输入姓名仅显示匹配员工", async () => {
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find("input[placeholder*='搜索员工']").setValue("张三");
    await flushPromises();

    expect(wrapper.findAll(".el-table__row")).toHaveLength(1);
    expect(wrapper.find(".el-table").text()).toContain("张三");
    expect(wrapper.find(".el-table").text()).not.toContain("李四");
  });

  it("点击列头可按累计积分升序/降序排序（回归：sortable 缺 sort-method 时点击无效）", async () => {
    const wrapper = mountPage();
    await flushPromises();

    const headers = wrapper.findAll(".el-table__header .caret-wrapper");
    expect(headers.length).toBe(2); // 仅可用积分/累计积分两列可排序
    const cumulativeHeader = headers[1];
    await cumulativeHeader.trigger("click"); // 第一次点击为升序
    await flushPromises();
    expect(rowIds(wrapper)[0]).toBe("6"); // 孙八累计 260 最低

    await cumulativeHeader.trigger("click"); // 再点切换降序
    await flushPromises();
    expect(rowIds(wrapper)[0]).toBe("3"); // 王五累计 2980 最高
  });

  it("停用员工展示状态徽标", async () => {
    const wrapper = mountPage();
    await flushPromises();

    const text = wrapper.find(".el-table").text();
    expect(text).toContain("在职");
    expect(text).toContain("停用");
  });

  it("加载失败：页面不崩，表格保持空态", async () => {
    mockedEmployees.mockRejectedValue(new Error("网络请求失败"));
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find(".el-table").exists()).toBe(true);
    expect(wrapper.findAll(".el-table__row")).toHaveLength(0);
  });
});
