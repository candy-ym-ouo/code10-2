import { describe, expect, it } from "vitest";
import {
  buildProfilePatch,
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

describe("profile settings merge", () => {
  it("requires a version for optimistic concurrency", () => {
    expect(updateProfileSchema.safeParse({ timezone: "Asia/Shanghai" }).success).toBe(false);
    const parsed = updateProfileSchema.parse({ timezone: "Asia/Shanghai", version: 3 });
    expect(parsed.version).toBe(3);
  });

  it("merges only submitted preference fields", () => {
    expect(buildProfilePatch({ timezone: "Asia/Tokyo" })).toEqual({ timezone: "Asia/Tokyo" });
    expect(buildProfilePatch({ defaultInstrument: null, locale: "en-US" })).toEqual({
      defaultInstrument: null,
      locale: "en-US",
    });
    expect(buildProfilePatch({})).toEqual({});
  });

  it("never includes security fields in the patch", () => {
    const malicious = { timezone: "UTC", passwordHash: "x", status: "LOCKED", email: "a@b.c", version: 99 };
    const patch = buildProfilePatch(malicious as unknown as Parameters<typeof buildProfilePatch>[0]);
    expect(patch).toEqual({ timezone: "UTC" });
    expect(patch).not.toHaveProperty("passwordHash");
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("version");
  });
});
