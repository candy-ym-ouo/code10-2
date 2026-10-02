import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatTimeMs,
  parseTimeInput,
  setFormatPreferences,
  toDateTimeLocal,
  zonedWallTimeToUtc,
  todayInZone,
  startOfYearInZone,
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

describe("preference-driven timezone helpers", () => {
  it("converts wall time in the configured zone to the correct UTC instant", () => {
    setFormatPreferences({ timezone: "Asia/Shanghai", locale: "zh-CN" });
    // UTC+8，无夏令时
    expect(zonedWallTimeToUtc("2026-07-01", "14:00:00").toISOString()).toBe("2026-07-01T06:00:00.000Z");
    expect(toDateTimeLocal(new Date("2026-07-01T06:00:00Z"), "Asia/Shanghai")).toBe("2026-07-01T14:00");
  });

  it("handles daylight-saving zones", () => {
    // 美东夏令时 UTC-4
    expect(zonedWallTimeToUtc("2026-07-01", "12:00:00", "America/New_York").toISOString()).toBe("2026-07-01T16:00:00.000Z");
    // 美东冬令时 UTC-5
    expect(zonedWallTimeToUtc("2026-01-15", "12:00:00", "America/New_York").toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });

  it("round-trips day boundaries used by the statistics view", () => {
    setFormatPreferences({ timezone: "Asia/Shanghai", locale: "zh-CN" });
    const ref = new Date("2026-10-02T18:30:00Z");
    expect(todayInZone("Asia/Shanghai", ref)).toBe("2026-10-03");
    expect(startOfYearInZone(2026, "Asia/Shanghai").toISOString()).toBe("2025-12-31T16:00:00.000Z");
  });

  it("falls back to the default zone when configured timezone is invalid", () => {
    setFormatPreferences({ timezone: "Not/AZone", locale: "zh-CN" });
    expect(toDateTimeLocal(new Date("2026-07-01T06:00:00Z"))).toBe("2026-07-01T14:00");
    setFormatPreferences({ timezone: "Asia/Shanghai", locale: "zh-CN" });
  });
});
