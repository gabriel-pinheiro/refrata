import { describe, expect, it } from "vitest";

import { lit, play } from "./visual-harness.ts";

const FRAME = 0.025;

describe("Strobe", () => {
  it("flashes every Target on the beat and lets go between flashes", () => {
    const strobe = play("strobe", { rate: 4, flash: 30 });
    expect(lit(strobe.frame(0, ["a", "b"]), "color")).toEqual(["a", "b"]);
    expect(lit(strobe.frame(FRAME, ["a", "b"]), "level")).toEqual(["a", "b"]);
    expect(lit(strobe.frame(FRAME, ["a", "b"]), "color")).toEqual([]);
    // A quarter of a second after the first beat comes the second.
    for (let frame = 0; frame < 7; frame += 1)
      expect(lit(strobe.frame(FRAME, ["a", "b"]), "color")).toEqual([]);
    expect(lit(strobe.frame(FRAME, ["a", "b"]), "color")).toEqual(["a", "b"]);
  });

  it("shows a flash shorter than a frame for one frame, and fades out", () => {
    const strobe = play("strobe", { rate: 1, flash: 0, fadeOut: 100 });
    expect(strobe.frame(0, ["a"]).color?.a?.[1]).toBe(1);
    expect(strobe.frame(0.05, ["a"]).color?.a?.[1]).toBeCloseTo(0.5);
    expect(lit(strobe.frame(0.05, ["a"]), "color")).toEqual([]);
  });

  it("spreads the beat over the Targets", () => {
    const strobe = play("strobe", { rate: 1, phaseSpread: 1, flash: 30 });
    expect(lit(strobe.frame(0, ["a", "b"]), "color")).toEqual(["a"]);
    expect(lit(strobe.frame(0.5, ["a", "b"]), "color")).toEqual(["b"]);
  });

  it("stays dark with Run off until a Cue: one flash, or a burst of them", () => {
    const strobe = play("strobe", { run: false, rate: 10, burst: 2 });
    expect(lit(strobe.frame(FRAME, ["a"]), "color")).toEqual([]);
    strobe.cue("flash");
    expect(lit(strobe.frame(FRAME, ["a"]), "color")).toEqual(["a"]);
    strobe.frame(0.05, ["a"]);
    strobe.cue("burst");
    let flashes = 0;
    let wasLit = false;
    for (let frame = 0; frame < 40; frame += 1) {
      const isLit = lit(strobe.frame(FRAME, ["a"]), "color").length > 0;
      if (isLit && !wasLit) flashes += 1;
      wasLit = isLit;
    }
    expect(flashes).toBe(2);
  });

  it("gives each Target a beat of its own with Random phase", () => {
    const strobe = play("strobe", { rate: 1, randomPhase: true });
    const keys = ["a", "b", "c", "d", "e", "f"];
    const first = new Map<string, number>();
    for (let frame = 0; frame < 40; frame += 1)
      for (const key of lit(strobe.frame(FRAME, keys), "color"))
        if (!first.has(key)) first.set(key, frame);
    expect(first.size).toBe(keys.length);
    expect(new Set(first.values()).size).toBeGreaterThan(2);
  });
});

describe("Shutter", () => {
  it("asks for Multiply and writes 1 while open, 1 less Depth while closed", () => {
    const shutter = play("shutter", { rate: 4, open: 30, depth: 0.75 });
    expect(shutter.frame(0, ["a"]).value?.a).toEqual([1, 1]);
    shutter.frame(FRAME, ["a"]);
    expect(shutter.frame(FRAME, ["a"]).value?.a?.[0]).toBeCloseTo(0.25);
  });

  it("stays open at rate 0", () => {
    const shutter = play("shutter", { rate: 0 });
    expect(shutter.frame(FRAME, ["a"]).value?.a?.[0]).toBe(1);
    expect(shutter.frame(1, ["a"]).value?.a?.[0]).toBe(1);
  });
});

describe("Pump", () => {
  it("dips on the beat and on the Hit Cue, and recovers", () => {
    const pump = play("pump", { rate: 0, depth: 0.8, recover: 200 });
    expect(pump.frame(FRAME, ["a"]).value?.a?.[0]).toBe(1);
    pump.cue("hit");
    expect(pump.frame(FRAME, ["a"]).value?.a?.[0]).toBeCloseTo(0.2);
    const halfway = pump.frame(0.1, ["a"]).value?.a?.[0] as number;
    expect(halfway).toBeCloseTo(1 - 0.8 * 0.25);
    expect(pump.frame(0.1, ["a"]).value?.a?.[0]).toBe(1);
  });
});
