import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createUniStub } from "../helpers/uni-stub";
import AppTabBar from "../../components/AppTabBar.vue";
import { homeBadges } from "../../utils/badge-state";

/** L2 组件测试：底栏「首页」标签红点（首页快捷入口任一角标 >0 时点亮，全 0 时熄灭） */

describe("AppTabBar 首页红点", () => {
  beforeEach(() => {
    createUniStub();
    homeBadges.messages = 0;
    homeBadges.votes = 0;
    homeBadges.orders = 0;
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

  it("无角标：首页标签不显示红点", () => {
    const wrapper = mountBar();
    expect(wrapper.find(".tab-dot").exists()).toBe(false);
  });

  it("任一角标 >0：显示红点（未读消息/待参与投票/审核中订单分别验证）", async () => {
    const wrapper = mountBar();

    homeBadges.messages = 2;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-dot").exists()).toBe(true);

    homeBadges.messages = 0;
    homeBadges.votes = 3;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-dot").exists()).toBe(true);

    homeBadges.votes = 0;
    homeBadges.orders = 1;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-dot").exists()).toBe(true);
  });

  it("角标全部归 0：红点熄灭", async () => {
    homeBadges.orders = 1;
    const wrapper = mountBar();
    expect(wrapper.find(".tab-dot").exists()).toBe(true);

    homeBadges.orders = 0;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".tab-dot").exists()).toBe(false);
  });

  it("任务大厅数字角标：进行中任务数显示为徽标文案，归 0 后消失（>99 显示 99+）", async () => {
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
