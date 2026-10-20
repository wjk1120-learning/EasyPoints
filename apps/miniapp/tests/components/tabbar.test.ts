import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import AppTabBar from "../../components/AppTabBar.vue";
import { homeBadges } from "../../utils/badge-state";

/** L2 组件测试：底栏数字角标（首页=三类待办合计；任务大厅=进行中任务数；>99 显示 99+） */

describe("AppTabBar 底栏数字角标", () => {
  beforeEach(() => {
    createUniStub();
    homeBadges.messages = 0;
    homeBadges.votes = 0;
    homeBadges.orders = 0;
    homeBadges.applications = 0;
    homeBadges.tasks = 0;
  });

  function mountBar() {
    return mount(AppTabBar, { global: { stubs: { AppIcon: true } } });
  }

  it("底栏 5 个标签：首页/积分商城/任务大厅/积分明细/我的", () => {
    const wrapper = mountBar();
    expect(wrapper.findAll(".tab-item")).toHaveLength(5);
    expect(wrapper.findAll(".tab-text").map((n) => n.text())).toEqual([
      "首页", "积分商城", "任务大厅", "积分明细", "我的"
    ]);
  });

  it("无角标：不显示任何数字徽标", () => {
    const wrapper = mountBar();
    expect(wrapper.find(".tab-badge").exists()).toBe(false);
  });

  it("首页徽标：显示未读消息+待参与投票+审核中订单+待审核申请之和，任一变化实时联动", async () => {
    const wrapper = mountBar();

    homeBadges.messages = 2;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-badge").text()).toBe("2");

    homeBadges.votes = 3;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-badge").text()).toBe("5");

    homeBadges.applications = 4;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-badge").text()).toBe("9");

    homeBadges.messages = 0;
    homeBadges.votes = 0;
    homeBadges.applications = 0;
    homeBadges.orders = 1;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-badge").text()).toBe("1");
  });

  it("首页角标全部归 0：徽标消失", async () => {
    homeBadges.orders = 1;
    const wrapper = mountBar();
    expect(wrapper.find(".tab-badge").text()).toBe("1");

    homeBadges.orders = 0;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-badge").exists()).toBe(false);
  });

  it("任务大厅徽标：进行中任务数显示为徽标文案，>99 显示 99+", async () => {
    const wrapper = mountBar();

    homeBadges.tasks = 2;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-badge").text()).toBe("2");

    homeBadges.tasks = 0;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-badge").exists()).toBe(false);

    homeBadges.tasks = 120;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-badge").text()).toBe("99+");
  });
});
