import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import WorkOrderDetail from "../../src/components/WorkOrderDetail.vue";
import { costPoints, signedPoints } from "../../src/utils/points";
import type { WorkOrderField } from "../../src/components/WorkOrderDetail.vue";

/**
 * L3 组件测试：工单详情描述列表的分值口径。
 * 回归背景：兑换工单详情曾把 pointsCost（成本，恒正）当 delta（变动，带符号）渲染，
 * 详情显示 +1000 绿色与列表 -1000 红色打架；现拆分 delta/cost 两种类型并以品牌类型防误用。
 */

function mountFields(fields: WorkOrderField[]) {
  return mount(WorkOrderDetail, { props: { fields }, global: { plugins: [ElementPlus] } });
}

describe("WorkOrderDetail", () => {
  it("delta（带符号变动）：正数 +N 加分类色，负数 -N 减分类色", () => {
    const wrapper = mountFields([
      { label: "奖励积分", value: signedPoints(200), type: "delta" },
      { label: "扣减分值", value: signedPoints(-50), type: "delta" }
    ]);

    const nodes = wrapper.findAll(".delta-text");
    expect(nodes.map((n) => n.text())).toEqual(["+200", "-50"]);
    expect(nodes[0].classes()).toContain("delta-add");
    expect(nodes[1].classes()).toContain("delta-deduct");
  });

  it("cost（消耗成本）：恒渲染 -N 减分类色，0 成本不加负号", () => {
    const wrapper = mountFields([
      { label: "消耗积分", value: costPoints(1000), type: "cost" },
      { label: "零成本", value: costPoints(0), type: "cost" }
    ]);

    const nodes = wrapper.findAll(".delta-text");
    expect(nodes.map((n) => n.text())).toEqual(["-1000", "0"]);
    expect(nodes[0].classes()).toContain("delta-deduct");
    expect(nodes[1].classes()).toContain("delta-deduct");
  });

  it("text：空值显示 — 占位", () => {
    const wrapper = mountFields([{ label: "处理备注", value: null }]);
    expect(wrapper.text()).toContain("—");
  });

  it("类型防护：成本误传 delta / 变动误传 cost 编译期报错（品牌类型）", () => {
    // @ts-expect-error CostPoints 不能赋给 delta 字段的 SignedPoints
    const costAsDelta: WorkOrderField[] = [{ label: "消耗积分", value: costPoints(100), type: "delta" }];
    // @ts-expect-error SignedPoints 不能赋给 cost 字段的 CostPoints
    const deltaAsCost: WorkOrderField[] = [{ label: "分值", value: signedPoints(100), type: "cost" }];
    expect(costAsDelta).toHaveLength(1);
    expect(deltaAsCost).toHaveLength(1);
  });
});
