import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatPoints, signedPoints, formatTime, friendlyTime } from "../../utils/format";

describe("formatPoints 千分位", () => {
  it("正数加逗号：1234 -> 1,234，1234567 -> 1,234,567", () => {
    expect(formatPoints(1234)).toBe("1,234");
    expect(formatPoints(1234567)).toBe("1,234,567");
  });

  it("负数保留符号：-1234 -> -1,234", () => {
    expect(formatPoints(-1234)).toBe("-1,234");
  });

  it("空值/非数字归零：null/undefined/'' -> 0", () => {
    expect(formatPoints(null)).toBe("0");
    expect(formatPoints(undefined)).toBe("0");
    expect(formatPoints("")).toBe("0");
  });

  it("字符串数字可解析：'2500' -> 2,500", () => {
    expect(formatPoints("2500")).toBe("2,500");
  });

  it("小数不崩溃", () => {
    expect(formatPoints(12.5)).toBe("12.5");
  });
});

describe("signedPoints 带符号", () => {
  it("正数加 + 前缀，负数原样，零无符号", () => {
    expect(signedPoints(1234)).toBe("+1,234");
    expect(signedPoints(-1234)).toBe("-1,234");
    expect(signedPoints(0)).toBe("0");
  });
});

describe("formatTime", () => {
  it("ISO/常见格式 -> MM-DD HH:mm", () => {
    expect(formatTime("2026-10-09 15:30:00")).toBe("10-09 15:30");
    expect(formatTime("2026-01-05T08:07:00")).toBe("01-05 08:07");
  });

  it("空值返回空串，不可解析原样返回", () => {
    expect(formatTime("")).toBe("");
    expect(formatTime(null)).toBe("");
    expect(formatTime("不是时间")).toBe("不是时间");
  });
});

describe("friendlyTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 14, 12, 0, 0)); // 2026-10-14 12:00
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("当天 -> 今天 HH:mm", () => {
    expect(friendlyTime("2026-10-14 09:05:00")).toBe("今天 09:05");
  });

  it("昨天 -> 昨天 HH:mm", () => {
    expect(friendlyTime("2026-10-13 23:59:00")).toBe("昨天 23:59");
  });

  it("更早 datetime 风格：MM-DD HH:mm（首页最近流水）", () => {
    expect(friendlyTime("2026-10-01 08:00:00")).toBe("10-01 08:00");
  });

  it("更早 date 风格：M月D日（消息中心）", () => {
    expect(friendlyTime("2026-10-01 08:00:00", "date")).toBe("10月01日");
  });

  it("空值返回空串，不可解析截断 16 字符", () => {
    expect(friendlyTime("")).toBe("");
    expect(friendlyTime("2026-13-99 99:99:99-overflow")).toBe("2026-13-99 99:99");
  });
});
