import { afterEach, describe, expect, it } from "vitest";
import {
  dayRangeInTimezone,
  formatDateTime,
  formatDuration,
  formatTimeMs,
  getFormatPreferences,
  parseTimeInput,
  setFormatPreferences,
} from "../src/utils/format.js";

describe("audio time formatting", () => {
  it("round-trips millisecond marker values", () => {
    expect(formatTimeMs(65_432)).toBe("01:05.432");
    expect(parseTimeInput("01:05.432")).toBe(65_432);
  });

  it("formats session duration for UI", () => {
    expect(formatDuration(90_000)).toBe("2 分钟");
    expect(formatDuration(3_660_000)).toBe("1 小时 1 分钟");
  });

  it("rejects invalid time input", () => {
    expect(parseTimeInput("01:60")).toBeNull();
  });
});

describe("format preferences linkage", () => {
  afterEach(() => {
    setFormatPreferences({});
  });

  it("renders history timestamps in the configured timezone and locale", () => {
    const instant = "2026-01-15T16:00:00.000Z";
    setFormatPreferences({ locale: "zh-CN", timezone: "Asia/Shanghai" });
    expect(formatDateTime(instant)).toContain("1月16日");
    setFormatPreferences({ locale: "zh-CN", timezone: "America/New_York" });
    expect(formatDateTime(instant)).toContain("1月15日");
  });

  it("falls back to defaults when preferences are cleared", () => {
    setFormatPreferences({ locale: "en-US", timezone: "UTC" });
    expect(getFormatPreferences()).toEqual({ locale: "en-US", timezone: "UTC" });
    setFormatPreferences({});
    expect(getFormatPreferences().locale).toBe("zh-CN");
    expect(getFormatPreferences().timezone).toBeTruthy();
  });
});

describe("dayRangeInTimezone", () => {
  it("maps a calendar day to the UTC range of the configured timezone", () => {
    const { from, to } = dayRangeInTimezone("2026-01-16", "Asia/Shanghai");
    expect(from.toISOString()).toBe("2026-01-15T16:00:00.000Z");
    expect(to.toISOString()).toBe("2026-01-16T15:59:59.999Z");
  });

  it("keeps the day boundary aligned across daylight saving time", () => {
    const { from, to } = dayRangeInTimezone("2026-07-01", "America/New_York");
    expect(from.toISOString()).toBe("2026-07-01T04:00:00.000Z");
    expect(to.toISOString()).toBe("2026-07-02T03:59:59.999Z");
  });
});
