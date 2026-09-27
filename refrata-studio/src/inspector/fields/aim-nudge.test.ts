import { settings } from "@refrata/core";
import { describe, expect, it } from "vitest";

import {
  arrowNudge,
  formatDegrees,
  nudgeStep,
  padStep,
  parseDegrees,
} from "./aim-nudge";

const plain = { shiftKey: false, ctrlKey: false, metaKey: false };

describe("aim nudges", () => {
  it("steps by the settings, coarser with shift and finer with ctrl", () => {
    expect(nudgeStep(plain)).toBe(settings.aim.nudge);
    expect(nudgeStep({ ...plain, shiftKey: true })).toBe(
      settings.aim.nudgeCoarse,
    );
    expect(nudgeStep({ ...plain, ctrlKey: true })).toBe(settings.aim.nudgeFine);
    expect(nudgeStep({ ...plain, metaKey: true })).toBe(settings.aim.nudgeFine);
    expect(padStep({ ...plain, shiftKey: true })).toBeCloseTo(
      (settings.aim.padDegreesPerPx * settings.aim.nudgeCoarse) /
        settings.aim.nudge,
    );
  });

  it("moves pan with left and right, tilt with up and down", () => {
    expect(arrowNudge("ArrowLeft", 2)).toEqual({ axis: "pan", delta: -2 });
    expect(arrowNudge("ArrowRight", 2)).toEqual({ axis: "pan", delta: 2 });
    expect(arrowNudge("ArrowUp", 2)).toEqual({ axis: "tilt", delta: 2 });
    expect(arrowNudge("ArrowDown", 2)).toEqual({ axis: "tilt", delta: -2 });
    expect(arrowNudge("Enter", 2)).toBeUndefined();
  });

  it("reads typed degrees, with or without the sign, clamped as aim.edit clamps", () => {
    const limits = { min: -90, max: 90 };
    expect(parseDegrees("12.34", 0, limits)).toBe(12.34);
    expect(parseDegrees("-30°", 0, limits)).toBe(-30);
    expect(parseDegrees("200", 0, limits)).toBe(90);
    // A value stored beyond the limits may stay or move in, never out.
    expect(parseDegrees("200", 120, limits)).toBe(120);
    expect(parseDegrees("100", 120, limits)).toBe(100);
    expect(parseDegrees("up", 0, limits)).toBeUndefined();
    expect(parseDegrees(" ", 0, limits)).toBeUndefined();
    expect(formatDegrees(-12.345)).toBe("-12.3");
  });
});
