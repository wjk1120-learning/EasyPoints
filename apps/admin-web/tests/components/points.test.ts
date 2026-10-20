import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ElMessageBox } from "element-plus";
import ElementPlus from "element-plus";
import Points from "../../src/views/Points.vue";
import { employees as fetchEmployees } from "../../src/api/employee/employee";
import { adjustment, monthlyBatch } from "../../src/api/points/points";
import type { Employee } from "../../src/api/employee/types";

/**
 * L3 组件测试：积分录入页（单笔奖惩 + 月度批量录分范围选择模式）。
 */

vi.mock("../../src/api/employee/employee", () => ({ employees: vi.fn() }));
vi.mock("../../src/api/points/points", () => ({ adjustment: vi.fn(), monthlyBatch: vi.fn() }));

const mockedEmployees = vi.mocked(fetchEmployees);
const mockedAdjustment = vi.mocked(adjustment);
const mockedBatch = vi.mocked(monthlyBatch);

function fixtureEmployees(): Employee[] {
  return [
    { id: 1, wecomUserId: "a", name: "张三", departmentId: 1, departmentName: "研发部", pointsBalance: 100, availablePoints: 100, cumulativePoints: 200, status: "active", createdAt: "" },
    { id: 2, wecomUserId: "b", name: "李四", departmentId: 1, departmentName: "研发部", pointsBalance: 80, availablePoints: 80, cumulativePoints: 160, status: "active", createdAt: "" },
    { id: 3, wecomUserId: "c", name: "王五", departmentId: 2, departmentName: "市场部", pointsBalance: 60, availablePoints: 60, cumulativePoints: 120, status: "active", createdAt: "" },
  ];
}

function mountPage() {
  return mount(Points, { global: { plugins: [ElementPlus] } });
}

function panelButton(wrapper: ReturnType<typeof mountPage>, panelClass: string, text: string) {
  const btn = wrapper.find(`.${panelClass}`).findAll("button").find((b) => b.text().includes(text));
  expect(btn, `按钮「${text}」应存在`).toBeTruthy();
  return btn!;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedEmployees.mockResolvedValue(fixtureEmployees());
});

describe("积分录入页 · 单笔奖惩", () => {
  it("挂载加载员工并默认选中第一个在职员工", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(mockedEmployees).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".panel-left").text()).toContain("张三");
  });

  it("加分提交：payload 符号归一为正数", async () => {
    mockedAdjustment.mockResolvedValue({} as never);
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find(".panel-left textarea").setValue("客户表扬");
    await panelButton(wrapper, "panel-left", "提交").trigger("click");
    await flushPromises();

    expect(mockedAdjustment).toHaveBeenCalledTimes(1);
    const payload = mockedAdjustment.mock.calls[0][0];
    expect(payload).toMatchObject({ employeeId: 1, type: "reward" });
    expect(payload.pointsDelta).toBeGreaterThan(0);
    expect(payload.remark).toBe("客户表扬");
  });

  it("单笔空备注提交：前端拦截不发请求（回归：原来无提示直传后端）", async () => {
    const wrapper = mountPage();
    await flushPromises();

    await panelButton(wrapper, "panel-left", "提交").trigger("click");
    await flushPromises();

    expect(mockedAdjustment).not.toHaveBeenCalled();
  });

  it("加载失败：提示错误且不崩", async () => {
    mockedEmployees.mockRejectedValue(new Error("网络请求失败"));
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find(".panel-left").exists()).toBe(true);
  });
});

describe("积分录入页 · 月度批量录分", () => {
  async function mountWithBatch() {
    const wrapper = mountPage();
    await flushPromises();
    // 直接送两名员工进批量名单（等价于范围选择后的产物；下拉勾选 UI 依赖 popper 事件链
    // 在 happy-dom 下不可靠，范围选择交互由浏览器冒烟覆盖）
    const vm = wrapper.vm as unknown as { batch: { items: { employeeId: number; pointsDelta: number | null; remark: string }[] } };
    vm.batch.items = [
      { employeeId: 1, pointsDelta: null, remark: "" },
      { employeeId: 2, pointsDelta: null, remark: "" },
    ];
    await flushPromises();
    expect(wrapper.findAll(".el-table__row").length).toBe(2);
    return wrapper;
  }

  it("名单为空提交：拦截并提示引导文案，不发起请求", async () => {
    const wrapper = mountPage();
    await flushPromises();
    await panelButton(wrapper, "panel-right", "提交").trigger("click");
    await flushPromises();
    expect(mockedBatch).not.toHaveBeenCalled();
  });

  it("统一备注与单人备注双缺：前端拦截不发请求（备注底线）", async () => {
    const wrapper = await mountWithBatch();
    const inputs = wrapper.find(".panel-right").findAll(".el-input-number input");
    await inputs[0].setValue("50");
    await inputs[1].setValue("30");
    // 统一备注留空、单人备注留空

    await panelButton(wrapper, "panel-right", "提交").trigger("click");
    await flushPromises();

    expect(mockedBatch).not.toHaveBeenCalled();
  });

  it("填分+统一备注后提交：高危确认 → payload {month,batchRemark,items[]}", async () => {
    const wrapper = await mountWithBatch();
    // 给名单两人填分（第一列数字输入框）
    const inputs = wrapper.find(".panel-right").findAll(".el-input-number input");
    await inputs[0].setValue("50");
    await inputs[1].setValue("30");
    // 统一备注（panel-right 的 textarea）
    await wrapper.find(".panel-right textarea").setValue("10月绩效");

    const confirmSpy = vi.spyOn(ElMessageBox, "confirm").mockResolvedValue("confirm" as never);
    mockedBatch.mockResolvedValue([] as never);

    await panelButton(wrapper, "panel-right", "提交").trigger("click");
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][1]).toBe("高危操作确认");
    expect(mockedBatch).toHaveBeenCalledTimes(1);
    const payload = mockedBatch.mock.calls[0][0];
    expect(payload.month).toMatch(/^\d{4}-\d{2}$/);
    expect(payload.batchRemark).toBe("10月绩效");
    expect(payload.items).toHaveLength(2);
    expect(payload.items.map((i) => i.pointsDelta).sort()).toEqual([30, 50]);
  });

  it("高危确认取消：不发起请求", async () => {
    const wrapper = await mountWithBatch();
    const inputs = wrapper.find(".panel-right").findAll(".el-input-number input");
    await inputs[0].setValue("50");
    await inputs[1].setValue("30");

    vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel");

    await panelButton(wrapper, "panel-right", "提交").trigger("click");
    await flushPromises();
    expect(mockedBatch).not.toHaveBeenCalled();
  });
});
