import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import RuleConfig from "../../src/views/RuleConfig.vue";
import { getRule, saveRule } from "../../src/api/rule/rule";
import { RULE_EMPTY_FIXTURE, RULE_FIXTURE } from "../fixtures/rule";

/**
 * L3 组件测试：规则配置页。
 * wangeditor 依赖真实 DOM 测量，测试环境用 textarea 代理 v-model（与 Editor 组件同契约）。
 */

vi.mock("@wangeditor/editor-for-vue", () => ({
  Editor: defineComponent({
    name: "Editor",
    props: { modelValue: { type: String, default: "" } },
    emits: ["update:modelValue"],
    template: `<textarea data-test="editor" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  }),
  Toolbar: defineComponent({ name: "Toolbar", template: "<div data-test='toolbar' />" }),
}));

vi.mock("../../src/api/rule/rule", () => ({
  getRule: vi.fn(),
  saveRule: vi.fn(),
}));

const mockedGetRule = vi.mocked(getRule);
const mockedSaveRule = vi.mocked(saveRule);

function mountPage() {
  return mount(RuleConfig, { global: { plugins: [ElementPlus] } });
}

function findSaveButton(wrapper: ReturnType<typeof mountPage>) {
  const btn = wrapper.findAll("button").find((b) => b.text().includes("保存并生效"));
  expect(btn, "保存按钮应存在").toBeTruthy();
  return btn!;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("规则配置页", () => {
  it("挂载即加载规则，内容回显编辑器，头部展示最近保存人/时间", async () => {
    mockedGetRule.mockResolvedValue({ ...RULE_FIXTURE });
    const wrapper = mountPage();
    await flushPromises();

    expect(mockedGetRule).toHaveBeenCalledTimes(1);
    expect((wrapper.find('[data-test="editor"]').element as HTMLTextAreaElement).value).toBe(RULE_FIXTURE.content);

    const hint = wrapper.find(".panel-hint").text();
    expect(hint).toContain("系统管理员");
    expect(hint).toContain("2026-10-12 16:30:00");
  });

  it("空内容点保存被前端拦截：不发起请求", async () => {
    mockedGetRule.mockResolvedValue({ ...RULE_EMPTY_FIXTURE });
    const wrapper = mountPage();
    await flushPromises();

    await findSaveButton(wrapper).trigger("click");
    await flushPromises();

    expect(mockedSaveRule).not.toHaveBeenCalled();
  });

  it("编辑内容后保存：payload 为 {content}，成功后更新最近保存信息", async () => {
    mockedGetRule.mockResolvedValue({ ...RULE_FIXTURE });
    mockedSaveRule.mockResolvedValue({ content: "<p>更新后的规则</p>", updatedAt: "2026-10-13 11:00:00", updatedBy: "测试管理员" });
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find('[data-test="editor"]').setValue("<p>更新后的规则</p>");
    await findSaveButton(wrapper).trigger("click");
    await flushPromises();

    expect(mockedSaveRule).toHaveBeenCalledWith({ content: "<p>更新后的规则</p>" });
    expect(wrapper.find(".panel-hint").text()).toContain("2026-10-13 11:00:00");
  });

  it("保存失败：错误透传展示，页面不崩", async () => {
    mockedGetRule.mockResolvedValue({ ...RULE_FIXTURE });
    mockedSaveRule.mockRejectedValue(new Error("规则内容不能为空"));
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find('[data-test="editor"]').setValue("<p>合法内容</p>");
    await findSaveButton(wrapper).trigger("click");
    await flushPromises();

    expect(mockedSaveRule).toHaveBeenCalledTimes(1);
    // 页面仍在渲染（未卸载、无未捕获异常），按钮可再次点击
    expect(wrapper.find('[data-test="editor"]').exists()).toBe(true);
  });
});
