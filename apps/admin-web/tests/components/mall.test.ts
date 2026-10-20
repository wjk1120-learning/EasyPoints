import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ElMessageBox } from "element-plus";
import ElementPlus from "element-plus";
import Mall from "../../src/views/Mall.vue";
import { adjustGiftStock, mallGifts, updateGift } from "../../src/api/mall/mall";
import type { Gift } from "../../src/api/mall/types";
import { GIFTS_FIXTURE } from "../fixtures/mall";

/**
 * L3 组件测试：礼品商城页（库存分离改造）。
 * 弹窗可能 teleport 到 body，DOM 断言统一走 document 查询。
 */

vi.mock("../../src/api/mall/mall", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/api/mall/mall")>();
  return {
    ...actual,
    mallGifts: vi.fn(),
    createGift: vi.fn(),
    updateGift: vi.fn(),
    adjustGiftStock: vi.fn(),
    publishGift: vi.fn(),
    unpublishGift: vi.fn(),
  };
});

const mockedGifts = vi.mocked(mallGifts);
const mockedUpdate = vi.mocked(updateGift);
const mockedAdjust = vi.mocked(adjustGiftStock);

function fixtureGifts(): Gift[] {
  return GIFTS_FIXTURE.map((g) => ({ ...g }));
}

function mountPage() {
  return mount(Mall, { global: { plugins: [ElementPlus] }, attachTo: document.body });
}

function findRowButton(rowText: string, buttonText: string): HTMLElement | null {
  const row = [...document.querySelectorAll(".el-table__row")].find((r) => r.textContent?.includes(rowText));
  if (!row) return null;
  return ([...row.querySelectorAll("button")] as HTMLElement[]).find((b) => b.textContent?.includes(buttonText)) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGifts.mockResolvedValue(fixtureGifts());
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("礼品商城页（库存分离）", () => {
  it("挂载即加载礼品列表（含下架礼品），库存列渲染", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(mockedGifts).toHaveBeenCalledTimes(1);
    const text = wrapper.find(".el-table").text();
    expect(text).toContain("京东购物卡 100 元");
    expect(text).toContain("保温杯（下架品）");
    expect(text).toContain("20");
  });

  it("编辑弹窗：库存输入禁用（改动库存只能走调库存），保存 payload 携带库存原值", async () => {
    const wrapper = mountPage();
    await flushPromises();

    mockedUpdate.mockResolvedValue(fixtureGifts()[0]);
    findRowButton("京东购物卡", "编辑")!.click();
    await flushPromises();

    const dialog = document.querySelector(".el-dialog");
    expect(dialog).toBeTruthy();
    expect(dialog!.querySelector(".el-input-number.is-disabled")).toBeTruthy(); // 库存禁用
    expect(dialog!.textContent).toContain("编辑礼品不改动库存");

    // 改名称后保存
    const nameInput = dialog!.querySelector(".el-dialog input") as HTMLInputElement;
    nameInput.value = "京东购物卡 200 元";
    nameInput.dispatchEvent(new Event("input"));
    await flushPromises();

    const saveBtn = ([...dialog!.querySelectorAll("button")] as HTMLElement[]).find((b) => b.textContent === "保存");
    saveBtn!.click();
    await flushPromises();

    expect(mockedUpdate).toHaveBeenCalledTimes(1);
    const [id, payload] = mockedUpdate.mock.calls[0];
    expect(id).toBe(1);
    expect(payload.stock).toBe(20); // 原值透传：新后端忽略，旧后端覆盖为同值
  });

  it("行内「调库存」：输入变化量后调 POST stock 接口（delta 语义）", async () => {
    const wrapper = mountPage();
    await flushPromises();

    const promptSpy = vi.spyOn(ElMessageBox, "prompt").mockResolvedValue({ value: "5" } as never);
    mockedAdjust.mockResolvedValue({ ...fixtureGifts()[0], stock: 25 });

    findRowButton("京东购物卡", "调库存")!.click();
    await flushPromises();

    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(mockedAdjust).toHaveBeenCalledWith(1, 5);
  });

  it("调库存取消（prompt reject）：不发起请求", async () => {
    const wrapper = mountPage();
    await flushPromises();

    vi.spyOn(ElMessageBox, "prompt").mockRejectedValue("cancel");
    findRowButton("京东购物卡", "调库存")!.click();
    await flushPromises();

    expect(mockedAdjust).not.toHaveBeenCalled();
  });

  it("新增弹窗：库存输入可编辑（新建可填库存）", async () => {
    const wrapper = mountPage();
    await flushPromises();

    ([...wrapper.findAll("button")].find((b) => b.text().includes("新增礼品"))!).trigger("click");
    await flushPromises();

    const dialog = document.querySelector(".el-dialog");
    expect(dialog).toBeTruthy();
    expect(dialog!.querySelector(".el-input-number.is-disabled")).toBeNull(); // 库存可编辑
  });
});
