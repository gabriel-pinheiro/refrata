import { describe, expect, it } from "vitest";

import { ATTRIBUTES, type AttributeKey } from "../rig/attributes.ts";
import { formPoint } from "./figure.ts";
import { unitOfDegrees } from "./sdk.ts";
import { lit, play } from "./visual-harness.ts";

/** What a degrees Slot wrote, back in degrees at the default binding: the Attribute's whole range. */
const degreesOf =
  (attribute: AttributeKey) =>
  (unit: unknown): number => {
    const definition = ATTRIBUTES[attribute];
    if (definition.kind !== "number")
      throw new Error(`${attribute} is not a number.`);
    const { min, max } = definition;
    return min + (typeof unit === "number" ? unit : 0.5) * (max - min);
  };
const pan = degreesOf("pan");
const tilt = degreesOf("tilt");

describe("degrees Slots", () => {
  it("write 0° at one half of pan and tilt and clamp at the range", () => {
    expect(unitOfDegrees("pan", 0)).toBe(0.5);
    expect(unitOfDegrees("tilt", 0)).toBe(0.5);
    expect(pan(unitOfDegrees("pan", 45))).toBeCloseTo(45);
    expect(tilt(unitOfDegrees("tilt", 45))).toBeCloseTo(45);
    expect(unitOfDegrees("tilt", 500)).toBe(1);
  });
});

describe("Figure", () => {
  it("draws a circle of Width and Height around the centre", () => {
    const figure = play("figure", { rate: 1, width: 60, height: 40 });
    const start = figure.frame(0, ["m"]);
    expect(pan(start.x?.m?.[0])).toBeCloseTo(30);
    expect(tilt(start.y?.m?.[0])).toBeCloseTo(0);
    const quarter = figure.frame(0.25, ["m"]);
    expect(pan(quarter.x?.m?.[0])).toBeCloseTo(0);
    expect(tilt(quarter.y?.m?.[0])).toBeCloseTo(20);
  });

  it("runs a Line in tilt at Rotation 90 and backwards on Direction", () => {
    const line = play("figure", {
      form: "line",
      rate: 1,
      width: 60,
      rotation: 90,
    });
    const start = line.frame(0, ["m"]);
    expect(pan(start.x?.m?.[0])).toBeCloseTo(0);
    expect(tilt(start.y?.m?.[0])).toBeCloseTo(30);
    const backward = play("figure", {
      rate: 1,
      width: 60,
      height: 60,
      direction: "backward",
    });
    backward.frame(0, ["m"]);
    expect(tilt(backward.frame(0.25, ["m"]).y?.m?.[0])).toBeCloseTo(-30);
  });

  it("walks the polygons corner to corner and spreads phase across Targets", () => {
    expect(formPoint("square", 0)).toEqual([1, 1]);
    expect(formPoint("square", 0.25)).toEqual([-1, 1]);
    expect(formPoint("diamond", 0.125)).toEqual([0.5, 0.5]);
    expect(formPoint("triangle", 1 / 3)).toEqual([-1, -1]);
    expect(formPoint("eight", 0.25)[1]).toBeCloseTo(0);
    expect(formPoint("spiral", 0)).toEqual([0, 0]);
    const spread = play("figure", { rate: 1, phaseSpread: 1 }).frame(0, [
      "a",
      "b",
    ]);
    expect(pan(spread.x?.a?.[0])).toBeCloseTo(15);
    expect(pan(spread.x?.b?.[0])).toBeCloseTo(-15);
  });
});

describe("Ballyhoo", () => {
  it("sends each mover somewhere of its own within Pan and Tilt", () => {
    const written = play("ballyhoo", { pan: 40, tilt: 20 }).frame(0, [
      "a",
      "b",
    ]);
    const xa = pan(written.x?.a?.[0]);
    const xb = pan(written.x?.b?.[0]);
    expect(xa).not.toBeCloseTo(xb);
    expect(Math.abs(xa)).toBeLessThanOrEqual(20);
    expect(Math.abs(tilt(written.y?.a?.[0]))).toBeLessThanOrEqual(10);
  });

  it("jumps at Glide 0, glides otherwise, and moves on Next", () => {
    const jumpy = play("ballyhoo", { rate: 1, glide: 0 });
    const before = jumpy.frame(0, ["a"]).x?.a?.[0];
    expect(jumpy.frame(0.1, ["a"]).x?.a?.[0]).toBe(before);
    const gliding = play("ballyhoo", { rate: 1, glide: 1 });
    const from = gliding.frame(0, ["a"]).x?.a?.[0];
    expect(gliding.frame(0.1, ["a"]).x?.a?.[0]).not.toBe(from);
    const held = play("ballyhoo", { rate: 0.05, glide: 0 });
    const resting = held.frame(0, ["a"]).x?.a?.[0];
    held.cue("next");
    expect(held.frame(0, ["a"]).x?.a?.[0]).toBe(resting);
    expect(held.frame(1, ["a"]).x?.a?.[0]).not.toBe(resting);
  });
});

describe("Fan", () => {
  it("leans the ends apart and keeps the middle still", () => {
    const line = play("fan", { pan: 60, tilt: 20 }).frame(0, ["a", "b", "c"]);
    expect(pan(line.x?.a?.[0])).toBeCloseTo(-30);
    expect(pan(line.x?.b?.[0])).toBeCloseTo(0);
    expect(pan(line.x?.c?.[0])).toBeCloseTo(30);
    expect(tilt(line.y?.c?.[0])).toBeCloseTo(10);
    const center = play("fan", { form: "center", pan: 60 }).frame(0, [
      "a",
      "b",
      "c",
    ]);
    expect(pan(center.x?.a?.[0])).toBeCloseTo(60);
    expect(pan(center.x?.b?.[0])).toBeCloseTo(0);
    expect(pan(center.x?.c?.[0])).toBeCloseTo(60);
    expect(pan(play("fan").frame(0, ["a"]).x?.a?.[0])).toBeCloseTo(0);
  });
});

describe("Flyout", () => {
  it("tilts from From to To while the level fades in, then sits dark", () => {
    const fly = play("flyout", {
      from: -30,
      to: 60,
      duration: 2,
      gap: 1,
      fadeIn: 0.5,
    });
    const start = fly.frame(0, ["m"]);
    expect(tilt(start.tilt?.m?.[0])).toBeCloseTo(-30);
    expect(start.level?.m?.[0]).toBe(0);
    const half = fly.frame(1, ["m"]);
    expect(tilt(half.tilt?.m?.[0])).toBeCloseTo(15);
    expect(half.level?.m?.[0]).toBeCloseTo(1);
    const dark = fly.frame(1.5, ["m"]);
    expect(tilt(dark.tilt?.m?.[0])).toBeCloseTo(-30);
    expect(dark.level?.m?.[0]).toBe(0);
    expect(fly.frame(0.5, ["m"]).level?.m?.[0]).toBe(0);
  });

  it("on Go flies once per cue and writes nothing in between", () => {
    const fly = play("flyout", { run: "go", duration: 1, gap: 0 });
    expect(lit(fly.frame(0, ["m"]), "tilt")).toEqual([]);
    fly.cue("go");
    expect(lit(fly.frame(0, ["m"]), "level")).toEqual(["m"]);
    fly.frame(0.5, ["m"]);
    expect(lit(fly.frame(0.6, ["m"]), "tilt")).toEqual([]);
  });
});

describe("Sweep", () => {
  it("crosses, holds at the end, bounces back and lets the next Target follow", () => {
    const sweep = play("sweep", {
      duration: 2,
      hold: 1,
      follow: 1,
      ease: "linear",
    });
    const start = sweep.frame(0, ["a", "b"]);
    expect(start.position?.a?.[0]).toBe(0);
    expect(start.position?.b?.[0]).toBe(0);
    const mid = sweep.frame(1, ["a", "b"]);
    expect(mid.position?.a?.[0]).toBeCloseTo(0.5);
    expect(mid.position?.b?.[0]).toBe(0);
    expect(sweep.frame(1, ["a", "b"]).position?.a?.[0]).toBe(1);
    expect(sweep.frame(0.5, ["a", "b"]).position?.a?.[0]).toBe(1);
    expect(sweep.frame(1.5, ["a", "b"]).position?.a?.[0]).toBeCloseTo(0.5);
    const loop = play("sweep", {
      duration: 2,
      hold: 0,
      follow: 0,
      ease: "smooth",
    });
    expect(loop.frame(1, ["a"]).position?.a?.[0]).toBeCloseTo(0.5);
    const jumped = play("sweep", {
      duration: 2,
      hold: 0,
      run: "loop",
      ease: "linear",
    });
    expect(jumped.frame(2.5, ["a"]).position?.a?.[0]).toBeCloseTo(0.25);
  });
});
