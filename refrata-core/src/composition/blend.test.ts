import { describe, expect, it } from "vitest";

import { blendNumber, blendValue } from "./blend.ts";

describe("blend", () => {
  it("crossfades, adds, multiplies and leans toward max or min by alpha", () => {
    expect(blendNumber(0.2, 1, 1, "normal")).toBe(1);
    expect(blendNumber(0.2, 1, 0.5, "normal")).toBeCloseTo(0.6);
    expect(blendNumber(0.2, 0.5, 1, "add")).toBeCloseTo(0.7);
    expect(blendNumber(0.8, 0.5, 1, "multiply")).toBeCloseTo(0.4);
    expect(blendNumber(0.8, 0.5, 0.5, "multiply")).toBeCloseTo(0.6);
    expect(blendNumber(0.8, 0.5, 1, "max")).toBe(0.8);
    expect(blendNumber(0.2, 0.5, 1, "max")).toBe(0.5);
    expect(blendNumber(0.8, 0.5, 1, "min")).toBe(0.5);
    expect(blendNumber(0.8, 0.5, 0.5, "min")).toBeCloseTo(0.65);
  });

  it("releases at alpha 0 and snaps choices and booleans at one half", () => {
    expect(blendValue("number", 0.3, 1, 0, "normal")).toBe(0.3);
    expect(blendValue("choice", "open", "closed", 0.49, "normal")).toBe("open");
    expect(blendValue("choice", "open", "closed", 0.5, "add")).toBe("closed");
    expect(blendValue("boolean", false, true, 1, "normal")).toBe(true);
  });

  it("blends colours per channel, weighed by the colour's own alpha, keeping the stack's alpha channel", () => {
    expect(
      blendValue("color", [0, 0, 0, 1], [1, 0.5, 0, 1], 0.5, "normal"),
    ).toEqual([0.5, 0.25, 0, 1]);
    expect(
      blendValue("color", [0, 0, 0, 1], [1, 0.5, 0, 0.2], 0.5, "normal"),
    ).toEqual([0.1, 0.05, 0, 1]);
    expect(
      blendValue("color", [0.3, 0.3, 0.3, 1], [1, 1, 1, 0], 1, "normal"),
    ).toEqual([0.3, 0.3, 0.3, 1]);
    expect(
      blendValue("color", [0.5, 0.5, 0.5, 1], [1, 0, 0, 1], 1, "multiply"),
    ).toEqual([0.5, 0, 0, 1]);
  });
});
