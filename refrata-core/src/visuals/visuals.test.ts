import { describe, expect, it } from "vitest";

import { CATALOG } from "./catalog.ts";
import { chaseSteps } from "./chase-order.ts";
import { lit, play } from "./visual-harness.ts";

describe("the Catalog", () => {
  it("lists the Visuals in the picker's order, each with a description and Slots", () => {
    expect(CATALOG.map((definition) => definition.id)).toEqual([
      "lfo",
      "shimmer",
      "chase",
      "strobe",
      "shutter",
      "pump",
      "rainbow",
      "static-number",
      "static-color",
      "circle",
      "meter",
      "counter",
      "timer",
      "reveal",
      "roulette",
    ]);
    for (const definition of CATALOG) {
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.slots.length).toBeGreaterThan(0);
    }
  });
});

describe("LFO", () => {
  it("swings between Low and High and restarts on sync", () => {
    const lfo = play("lfo", { rate: 1, low: 0.2, high: 0.6 });
    expect(lfo.frame(0, ["a"]).value?.a?.[0]).toBeCloseTo(0.2);
    expect(lfo.frame(0.5, ["a"]).value?.a?.[0]).toBeCloseTo(0.6);
    lfo.cue("sync");
    expect(lfo.frame(0, ["a"]).value?.a?.[0]).toBeCloseTo(0.2);
  });

  it("moves every Target together until Phase spread says otherwise", () => {
    const together = play("lfo", { rate: 1 }).frame(0.25, ["a", "b"]);
    expect(together.value?.a?.[0]).toBeCloseTo(
      together.value?.b?.[0] as number,
    );
    const wave = play("lfo", { rate: 1, phaseSpread: 1 }).frame(0.1, [
      "a",
      "b",
    ]);
    expect(wave.value?.a?.[0]).not.toBeCloseTo(wave.value?.b?.[0] as number);
  });
});

describe("Shimmer", () => {
  it("fires Count idle Targets per Cue at rate 0 and releases the rest", () => {
    const shimmer = play("shimmer", { rate: 0, count: 3, fadeIn: 0 });
    const keys = ["a", "b", "c", "d", "e", "f"];
    expect(lit(shimmer.frame(0.025, keys), "color")).toHaveLength(0);
    shimmer.cue("fire");
    const written = shimmer.frame(0.025, keys);
    expect(lit(written, "color")).toHaveLength(3);
    expect(lit(written, "level")).toEqual(lit(written, "color"));
    shimmer.cue("fire");
    expect(lit(shimmer.frame(0.025, keys), "color")).toHaveLength(6);
  });

  it("rises, holds, falls and then says nothing", () => {
    const shimmer = play("shimmer", {
      rate: 0,
      fadeIn: 100,
      hold: 100,
      fadeOut: 100,
    });
    shimmer.cue("fire");
    expect(shimmer.frame(0.05, ["a"]).color?.a?.[1]).toBeCloseTo(0.5);
    expect(shimmer.frame(0.05, ["a"]).color?.a?.[1]).toBeCloseTo(1);
    shimmer.frame(0.1, ["a"]);
    expect(shimmer.frame(0.05, ["a"]).color?.a?.[1]).toBeCloseTo(0.5);
    expect(lit(shimmer.frame(0.06, ["a"]), "color")).toEqual([]);
  });

  it("keeps a sparkle on its Target when another joins ahead of it", () => {
    const shimmer = play("shimmer", { rate: 0, fadeIn: 0, hold: 1_000 });
    shimmer.cue("fire");
    const [sparkling] = lit(shimmer.frame(0.025, ["a", "b"]), "color");
    expect(lit(shimmer.frame(0.025, ["new", "a", "b"]), "color")).toEqual([
      sparkling,
    ]);
  });

  it("fires by itself at its rate, evenly without jitter", () => {
    const shimmer = play("shimmer", { rate: 10, jitter: 0, fadeIn: 0 });
    const keys = Array.from({ length: 40 }, (_, index) => `t${index}`);
    let fired = 0;
    for (let frame = 0; frame < 40; frame += 1) {
      const before = fired;
      fired = Math.max(before, lit(shimmer.frame(0.025, keys), "color").length);
    }
    expect(fired).toBeGreaterThanOrEqual(3);
  });
});

describe("Chase", () => {
  const keys = ["a", "b", "c", "d"];

  it("holds the head until the next step, whatever the tempo", () => {
    const chase = play("chase", { rate: 0 });
    expect(lit(chase.frame(0.025, keys), "level")).toEqual(["a"]);
    expect(lit(chase.frame(5, keys), "level")).toEqual(["a"]);
    chase.cue("step");
    expect(lit(chase.frame(0.025, keys), "level")).toEqual(["b"]);
    chase.cue("restart");
    expect(lit(chase.frame(0.025, keys), "level")).toEqual(["a"]);
  });

  it("lights the same step again when its Targets are replaced", () => {
    const chase = play("chase", { rate: 0 });
    chase.frame(0.025, ["set"]);
    expect(lit(chase.frame(0.025, keys), "level")).toEqual(["a"]);
  });

  it("steps at its rate, and a step Cue re-arms the timer", () => {
    const chase = play("chase", { rate: 2 });
    chase.frame(0, keys);
    expect(lit(chase.frame(0.4, keys), "level")).toEqual(["a"]);
    chase.cue("step");
    expect(lit(chase.frame(0.025, keys), "level")).toEqual(["b"]);
    expect(lit(chase.frame(0.4, keys), "level")).toEqual(["b"]);
    expect(lit(chase.frame(0.1, keys), "level")).toEqual(["c"]);
  });

  it("glows a Tail behind the head at falling levels", () => {
    const chase = play("chase", { rate: 0, tail: 1 });
    chase.frame(0.025, keys);
    chase.cue("step");
    const written = chase.frame(0.025, keys);
    expect(written.level?.b?.[1]).toBe(1);
    expect(written.level?.a?.[1]).toBeCloseTo(0.5);
  });

  it("orders its steps", () => {
    expect(chaseSteps("center-out", 8)).toEqual([
      [3, 4],
      [2, 5],
      [1, 6],
      [0, 7],
    ]);
    expect(chaseSteps("ends-in", 5)).toEqual([[0, 4], [1, 3], [2]]);
    expect(chaseSteps("bounce", 4).flat()).toEqual([0, 1, 2, 3, 2, 1]);
    expect(chaseSteps("backward", 3).flat()).toEqual([2, 1, 0]);
  });
});

describe("Rainbow, the Statics and Circle", () => {
  it("lays the spectrum across the Targets", () => {
    const written = play("rainbow", { rate: 0 }).frame(0, ["a", "b", "c"]);
    expect(written.color?.a?.[0]).toEqual([1, 0, 0, 1]);
    expect(written.color?.b?.[0]).not.toEqual(written.color?.a?.[0]);
  });

  it("writes one value to every Target", () => {
    const number = play("static-number", { value: 0.3 }).frame(0, ["a", "b"]);
    expect(number.value).toEqual({ a: [0.3, 1], b: [0.3, 1] });
    expect(lit(play("static-color").frame(0, ["a"]), "color")).toEqual(["a"]);
  });

  it("draws a circle in two Slots", () => {
    const circle = play("circle", { rate: 1, radius: 0.25 });
    const start = circle.frame(0, ["m"]);
    expect(start.x?.m?.[0]).toBeCloseTo(0.75);
    expect(start.y?.m?.[0]).toBeCloseTo(0.5);
    const quarter = circle.frame(0.25, ["m"]);
    expect(quarter.x?.m?.[0]).toBeCloseTo(0.5);
    expect(quarter.y?.m?.[0]).toBeCloseTo(0.75);
  });
});
