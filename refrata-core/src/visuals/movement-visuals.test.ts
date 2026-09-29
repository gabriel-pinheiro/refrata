import { describe, expect, it } from "vitest";

import { ATTRIBUTES, type AttributeKey } from "../rig/attributes.ts";
import { formPoint } from "./figure.ts";
import { unitOfDegrees } from "./sdk.ts";
import { play } from "./visual-harness.ts";

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
  it("draws a circle that fills the Region, and less of it at a smaller Size", () => {
    const figure = play("figure", { rate: 1 });
    const start = figure.frame(0, ["m"]);
    expect(start.x?.m?.[0]).toBeCloseTo(1);
    expect(start.y?.m?.[0]).toBeCloseTo(0.5);
    const quarter = figure.frame(0.25, ["m"]);
    expect(quarter.x?.m?.[0]).toBeCloseTo(0.5);
    expect(quarter.y?.m?.[0]).toBeCloseTo(1);
    const small = play("figure", { rate: 1, size: 0.5 }).frame(0, ["m"]);
    expect(small.x?.m?.[0]).toBeCloseTo(0.75);
    expect(play("figure", { size: 0 }).frame(0, ["m"]).x?.m?.[0]).toBe(0.5);
  });

  it("leaves Rotation to the Region and runs backwards on Direction", () => {
    const line = play("figure", { form: "line", rate: 1, rotation: 90 });
    const start = line.frame(0, ["m"]);
    expect(start.x?.m?.[0]).toBeCloseTo(1);
    expect(start.y?.m?.[0]).toBeCloseTo(0.5);
    const backward = play("figure", { rate: 1, direction: "backward" });
    backward.frame(0, ["m"]);
    expect(backward.frame(0.25, ["m"]).y?.m?.[0]).toBeCloseTo(0);
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
    expect(spread.x?.a?.[0]).toBeCloseTo(1);
    expect(spread.x?.b?.[0]).toBeCloseTo(0);
  });
});

describe("Ballyhoo", () => {
  it("sends each mover somewhere of its own inside the Region", () => {
    const written = play("ballyhoo", {}).frame(0, ["a", "b"]);
    const xa = written.x?.a?.[0] as number;
    const xb = written.x?.b?.[0] as number;
    expect(xa).not.toBeCloseTo(xb);
    for (const value of [xa, xb, written.y?.a?.[0], written.y?.b?.[0]]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("jumps at Travel 0, travels otherwise, and waits out its Rate", () => {
    const jumpy = play("ballyhoo", { rate: 1, variance: 0, travel: 0 });
    const before = jumpy.frame(0, ["a"]).x?.a?.[0];
    expect(jumpy.frame(1, ["a"]).x?.a?.[0]).not.toBe(before);
    const settled = jumpy.frame(0.1, ["a"]).x?.a?.[0];
    expect(jumpy.frame(0.1, ["a"]).x?.a?.[0]).toBe(settled);
    const travelling = play("ballyhoo", { rate: 1, variance: 0, travel: 1 });
    travelling.frame(0, ["a"]);
    const from = travelling.frame(1, ["a"]).x?.a?.[0];
    expect(travelling.frame(0.1, ["a"]).x?.a?.[0]).not.toBe(from);
  });

  it("at Rate 0 moves on Next alone, every mover arriving together", () => {
    const held = play("ballyhoo", { rate: 0, travel: 2 });
    const resting = held.frame(0, ["a", "b"]);
    expect(held.frame(60, ["a", "b"])).toEqual(resting);
    held.cue("next");
    expect(held.frame(0, ["a", "b"])).toEqual(resting);
    const halfway = held.frame(1, ["a", "b"]);
    expect(halfway.x?.a?.[0]).not.toBe(resting.x?.a?.[0]);
    expect(halfway.x?.b?.[0]).not.toBe(resting.x?.b?.[0]);
    const arrived = held.frame(1, ["a", "b"]);
    expect(arrived.x?.a?.[0]).not.toBe(halfway.x?.a?.[0]);
    expect(held.frame(5, ["a", "b"])).toEqual(arrived);
  });

  it("holds a move by the Rate until a cued one has arrived", () => {
    const wander = play("ballyhoo", { rate: 1, variance: 0, travel: 3 });
    const from = wander.frame(0, ["a"]).x?.a?.[0] as number;
    wander.cue("next");
    wander.frame(0, ["a"]);
    const halfway = wander.frame(1.5, ["a"]).x?.a?.[0] as number;
    wander.frame(1.4, ["a"]);
    const arrived = wander.frame(0.1, ["a"]).x?.a?.[0] as number;
    expect(halfway).toBeCloseTo((from + arrived) / 2);
    expect(wander.frame(0.5, ["a"]).x?.a?.[0]).not.toBeCloseTo(arrived);
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
  const loop = { settle: 0, gap: 1, duration: 2 };

  it("tilts along the Region while the level fades in, then sits dark at the start", () => {
    const fly = play("flyout", { ...loop, fadeIn: 0.5 });
    const start = fly.frame(0, ["m"]);
    expect(start.tilt?.m?.[0]).toBe(0);
    expect(start.level?.m?.[0]).toBe(0);
    const half = fly.frame(1, ["m"]);
    expect(half.tilt?.m?.[0]).toBeCloseTo(0.5);
    expect(half.level?.m?.[0]).toBeCloseTo(1);
    const dark = fly.frame(1.5, ["m"]);
    expect(dark.tilt?.m?.[0]).toBe(0);
    expect(dark.level?.m?.[0]).toBe(0);
    const again = fly.frame(1, ["m"]);
    expect(again.tilt?.m?.[0]).toBeCloseTo(0.25);
  });

  it("flies from To to From on Tilt falling", () => {
    const fly = play("flyout", { ...loop, direction: "falling" });
    expect(fly.frame(0, ["m"]).tilt?.m?.[0]).toBe(1);
    expect(fly.frame(1, ["m"]).tilt?.m?.[0]).toBeCloseTo(0.5);
    expect(fly.frame(1.5, ["m"]).tilt?.m?.[0]).toBe(1);
  });

  it("waits out Settle and Gap between the flies of a Loop", () => {
    const fly = play("flyout", { duration: 1, settle: 0.5, gap: 1 });
    fly.frame(0, ["m"]);
    expect(fly.frame(0.4, ["m"]).level?.m?.[0]).toBe(0);
    expect(fly.frame(0.6, ["m"]).tilt?.m?.[0]).toBeCloseTo(0.5);
    expect(fly.frame(0.5, ["m"]).tilt?.m?.[0]).toBe(0);
    expect(fly.frame(1.4, ["m"]).tilt?.m?.[0]).toBe(0);
    expect(fly.frame(0.6, ["m"]).tilt?.m?.[0]).toBeCloseTo(0.5);
  });

  it("on Go waits dark at the start, at the pan of the fly to come", () => {
    const fly = play("flyout", { run: "go", duration: 1, settle: 0 });
    const waiting = fly.frame(5, ["m"]);
    expect(waiting.level?.m?.[0]).toBe(0);
    expect(waiting.tilt?.m?.[0]).toBe(0);
    fly.cue("go");
    fly.frame(0, ["m"]);
    const flying = fly.frame(0.5, ["m"]);
    expect(flying.level?.m?.[0]).toBe(1);
    expect(flying.tilt?.m?.[0]).toBeCloseTo(0.5);
    expect(flying.pan?.m?.[0]).toBe(waiting.pan?.m?.[0]);
    const back = fly.frame(0.5, ["m"]);
    expect(back.level?.m?.[0]).toBe(0);
    expect(back.pan?.m?.[0]).not.toBe(waiting.pan?.m?.[0]);
    expect(fly.frame(5, ["m"])).toEqual(back);
  });

  it("sits out a Go while flying or settling", () => {
    const fly = play("flyout", { run: "go", duration: 1, settle: 1 });
    fly.frame(0, ["m"]);
    fly.frame(1, ["m"]);
    fly.cue("go");
    fly.frame(0, ["m"]);
    fly.cue("go");
    expect(fly.frame(0.5, ["m"]).tilt?.m?.[0]).toBeCloseTo(0.5);
    fly.frame(0.5, ["m"]);
    fly.cue("go");
    expect(fly.frame(0.5, ["m"]).level?.m?.[0]).toBe(0);
    expect(fly.frame(5, ["m"]).level?.m?.[0]).toBe(0);
    fly.cue("go");
    fly.frame(0, ["m"]);
    expect(fly.frame(0.5, ["m"]).tilt?.m?.[0]).toBeCloseTo(0.5);
  });

  it("sends each Target Follow seconds after the one before, each judged when its turn comes", () => {
    const fly = play("flyout", {
      run: "go",
      duration: 1,
      settle: 0,
      follow: 0.5,
    });
    fly.cue("go");
    fly.frame(0, ["a", "b"]);
    const early = fly.frame(0.25, ["a", "b"]);
    expect(early.tilt?.a?.[0]).toBeCloseTo(0.25);
    expect(early.level?.b?.[0]).toBe(0);
    const later = fly.frame(0.5, ["a", "b"]);
    expect(later.tilt?.a?.[0]).toBeCloseTo(0.75);
    expect(later.tilt?.b?.[0]).toBeCloseTo(0.25);
    // A Go now finds the first still flying and, half a second on, the second too.
    fly.cue("go");
    fly.frame(0, ["a", "b"]);
    fly.frame(0.5, ["a", "b"]);
    const after = fly.frame(0.5, ["a", "b"]);
    expect(after.level?.a?.[0]).toBe(0);
    expect(after.level?.b?.[0]).toBe(0);
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

describe("Sweep with Automatic off", () => {
  it("crosses once per Go, the other way on Bounce, and sits out a Go while crossing", () => {
    const sweep = play("sweep", {
      automatic: false,
      duration: 2,
      hold: 1,
      follow: 1,
      ease: "linear",
    });
    expect(sweep.frame(10, ["a", "b"]).position?.a?.[0]).toBe(0);
    sweep.cue("go");
    sweep.frame(0, ["a", "b"]);
    sweep.cue("go");
    const mid = sweep.frame(1, ["a", "b"]);
    expect(mid.position?.a?.[0]).toBeCloseTo(0.5);
    expect(mid.position?.b?.[0]).toBe(0);
    const there = sweep.frame(10, ["a", "b"]);
    expect(there.position?.a?.[0]).toBe(1);
    expect(there.position?.b?.[0]).toBe(1);
    sweep.cue("go");
    sweep.frame(0, ["a", "b"]);
    const back = sweep.frame(1, ["a", "b"]);
    expect(back.position?.a?.[0]).toBeCloseTo(0.5);
    expect(back.position?.b?.[0]).toBe(1);
    expect(sweep.frame(10, ["a", "b"]).position?.b?.[0]).toBeCloseTo(0);
  });

  it("comes back to From after each crossing on Loop", () => {
    const sweep = play("sweep", {
      automatic: false,
      run: "loop",
      duration: 2,
      hold: 1,
      follow: 0,
      ease: "linear",
    });
    sweep.cue("go");
    sweep.frame(0, ["a"]);
    expect(sweep.frame(2.5, ["a"]).position?.a?.[0]).toBe(1);
    expect(sweep.frame(10, ["a"]).position?.a?.[0]).toBe(0);
  });
});
