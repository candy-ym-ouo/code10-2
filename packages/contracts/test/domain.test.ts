import { describe, expect, it } from "vitest";
import {
  calculateSessionDuration,
  canTransitionSession,
  describeMissingReview,
  isGoalProgressValid,
  updateProfileSchema,
  validateAnnotationRange,
} from "../src/index.js";

describe("session state machine", () => {
  it("allows the required completion transition", () => {
    expect(canTransitionSession("IN_REVIEW", "COMPLETED")).toBe(true);
    expect(canTransitionSession("DRAFT", "COMPLETED")).toBe(false);
  });
});

describe("annotation range", () => {
  it("rejects ranges under 100ms and outside media", () => {
    expect(validateAnnotationRange(100, 150, 1000)).toMatchObject({ ok: false });
    expect(validateAnnotationRange(900, 1100, 1000)).toMatchObject({ ok: false });
    expect(validateAnnotationRange(100, 250, 1000)).toEqual({ ok: true });
  });
});

describe("review completion", () => {
  it("returns every missing item instead of a generic failure", () => {
    expect(
      describeMissingReview({
        readyMediaCount: 0,
        annotationCount: 0,
        noIssues: false,
        nextFocus: "",
        openGoalCount: 0,
        newGoalCount: 0,
        progressUpdateCount: 0,
      }),
    ).toHaveLength(4);
  });
});

describe("goal values", () => {
  it("suggests achieved only when actual reaches target", () => {
    expect(isGoalProgressValid(90, 88)).toBe(true);
    expect(isGoalProgressValid(87, 88)).toBe(false);
  });

  it("sums only valid media durations", () => {
    expect(calculateSessionDuration([1000, null, 2500, -1])).toBe(3500);
  });
});

describe("profile update merge contract", () => {
  it("requires an optimistic-lock version", () => {
    expect(updateProfileSchema.safeParse({ displayName: "小林" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ version: 0, displayName: "小林" }).success).toBe(true);
  });

  it("accepts partial preference payloads for field-level merge", () => {
    const parsed = updateProfileSchema.parse({ version: 2, timezone: "America/New_York" });
    expect(parsed).toMatchObject({ version: 2, timezone: "America/New_York" });
    expect(parsed.displayName).toBeUndefined();
    expect(parsed.theme).toBeUndefined();
  });

  it("restricts theme and locale to supported values", () => {
    expect(updateProfileSchema.safeParse({ version: 0, theme: "DARK" })).toBeDefined();
    expect(updateProfileSchema.safeParse({ version: 0, theme: "NEON" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ version: 0, locale: "fr-FR" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ version: 0, locale: "en-US" }).success).toBe(true);
  });
});
