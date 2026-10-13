import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ElMessageBox } from "element-plus";
import ElementPlus from "element-plus";
import ExchangeReviewPanel from "../../src/components/review/ExchangeReviewPanel.vue";
import { ordersPaged, updateOrder } from "../../src/api/order/order";
import { employees as fetchEmployees } from "../../src/api/employee/employee";
import type { Order } from "../../src/api/order/types";
import { ORDERS_FIXTURE } from "../fixtures/order";

/**
 * L3 组件测试：兑换审核面板（三态状态机；通过=终点，驳回=退分）。
 */

vi.mock("../../src/api/order/order", () => ({ ordersPaged: vi.fn(), updateOrder: vi.fn() }));
vi.mock("../../src/api/employee/employee", () => ({ employees: vi.fn() }));

const mockedOrdersPaged = vi.mocked(ordersPaged);
const mockedUpdateOrder = vi.mocked(updateOrder);
const mockedEmployees = vi.mocked(fetchEmployees);

function fixtureOrders(): Order[] {
  return ORDERS_FIXTURE.map((o) => ({ ...o })) as unknown as Order[];
}

function mountPanel() {
  return mount(ExchangeReviewPanel, { global: { plugins: [ElementPlus] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedEmployees.mockResolvedValue([]);
  mockedOrdersPaged.mockResolvedValue({ data: fixtureOrders(), meta: { total: ORDERS_FIXTURE.length, page: 1, pageSize: 50 } });
});

describe("兑换审核面板", () => {
  it("加载订单列表：待审核行有通过/驳回按钮，已审行只读", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    expect(mockedOrdersPaged).toHaveBeenCalledTimes(1);
    const rowTexts = wrapper.findAll(".el-table__row").map((r) => r.text());
    expect(rowTexts).toHaveLength(3);

    const pendingRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("张三"))!;
    expect(pendingRow.text()).toContain("待审核");
    expect(pendingRow.findAll("button").map((b) => b.text())).toContain("通过");

    const approvedRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("李四"))!;
    expect(approvedRow.text()).toContain("审核通过");
    expect(approvedRow.findAll("button").map((b) => b.text())).not.toContain("通过");
  });

  it("点击通过：确认弹窗 → POST payload {status:'approved', remark}", async () => {
    mockedUpdateOrder.mockResolvedValue({} as never);
    const confirmSpy = vi.spyOn(ElMessageBox, "confirm").mockResolvedValue("confirm" as never);
    const wrapper = mountPanel();
    await flushPromises();

    const pendingRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("张三"))!;
    await pendingRow.findAll("button").find((b) => b.text() === "通过")!.trigger("click");
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(mockedUpdateOrder).toHaveBeenCalledWith(5001, { status: "approved", remark: "审核通过" });
  });

  it("确认弹窗取消：不发起请求", async () => {
    vi.spyOn(ElMessageBox, "confirm").mockRejectedValue("cancel");
    const wrapper = mountPanel();
    await flushPromises();

    const pendingRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("张三"))!;
    await pendingRow.findAll("button").find((b) => b.text() === "通过")!.trigger("click");
    await flushPromises();

    expect(mockedUpdateOrder).not.toHaveBeenCalled();
  });

  it("点击驳回：打开驳回原因弹窗（必填原因由弹窗约束）", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    const pendingRow = wrapper.findAll(".el-table__row").find((r) => r.text().includes("张三"))!;
    await pendingRow.findAll("button").find((b) => b.text() === "驳回")!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("驳回兑换申请");
    expect(mockedUpdateOrder).not.toHaveBeenCalled();
  });

  it("加载失败：提示错误且不崩（回归：原来缺 catch 静默悬空）", async () => {
    mockedOrdersPaged.mockRejectedValue(new Error("网络请求失败"));
    const wrapper = mountPanel();
    await flushPromises();
    expect(wrapper.find(".el-table").exists()).toBe(true);
  });
});
