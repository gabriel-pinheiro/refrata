import { describe, expect, it } from "vitest";

import type { Color } from "../parameters.ts";
import { lit, play } from "./visual-harness.ts";

const FOUR = ["a", "b", "c", "d"];
const alphaOf = (
  written: Record<string, Record<string, [number | Color, number]>>,
  key: string,
) => written.level?.[key]?.[1] ?? 0;

describe("Meter", () => {
  it("fills from the first Target, the next one partly", () => {
    const meter = play("meter", { value: 0.6, arrive: "cut" });
    const written = meter.frame(0, FOUR);
    expect(lit(written, "level")).toEqual(["a", "b", "c"]);
    expect(alphaOf(written, "b")).toBe(1);
    expect(alphaOf(written, "c")).toBeCloseTo(0.4);
  });

  it("snaps to Points and fills from the other end or the centre", () => {
    const halves = play("meter", { value: 0.4, points: 2, arrive: "cut" });
    expect(lit(halves.frame(0, FOUR), "level")).toEqual(["a", "b"]);
    const backward = play("meter", {
      value: 0.25,
      order: "backward",
      arrive: "cut",
    });
    expect(lit(backward.frame(0, FOUR), "level")).toEqual(["d"]);
    const centre = play("meter", {
      value: 0.5,
      order: "center-out",
      arrive: "cut",
    });
    expect(lit(centre.frame(0, FOUR), "level")).toEqual(["b", "c"]);
  });

  it("turns to Color end as the Value rises or along the Targets", () => {
    const byValue = play("meter", {
      value: 1,
      gradient: "value",
      arrive: "cut",
    });
    expect(byValue.frame(0, FOUR).color?.a?.[0]).toEqual([1, 0, 0, 1]);
    const along = play("meter", {
      value: 1,
      gradient: "targets",
      arrive: "cut",
    });
    const written = along.frame(0, FOUR);
    expect(written.color?.a?.[0]).toEqual([0, 1, 0, 1]);
    expect(written.color?.d?.[0]).toEqual([1, 0, 0, 1]);
  });
});

describe("Counter", () => {
  it("adds, removes and resets, never past the ends", () => {
    const counter = play("counter", { arrive: "cut" });
    expect(lit(counter.frame(0, FOUR), "level")).toEqual([]);
    counter.cue("add");
    counter.cue("add");
    expect(lit(counter.frame(0, FOUR), "level")).toEqual(["a", "b"]);
    counter.cue("remove");
    expect(lit(counter.frame(0, FOUR), "level")).toEqual(["a"]);
    for (let press = 0; press < 9; press += 1) counter.cue("add");
    expect(lit(counter.frame(0, FOUR), "level")).toEqual(FOUR);
    counter.cue("remove");
    expect(lit(counter.frame(0, FOUR), "level")).toEqual(["a", "b", "c"]);
    counter.cue("reset");
    expect(lit(counter.frame(0, FOUR), "level")).toEqual([]);
  });

  it("lights a share of the Targets for each of its Points", () => {
    const counter = play("counter", { points: 2, arrive: "cut" });
    counter.cue("add");
    expect(lit(counter.frame(0, FOUR), "level")).toEqual(["a", "b"]);
  });

  it("drops a point in from the far end and stacks it", () => {
    const counter = play("counter", { arrive: "drop", arriveTime: 400 });
    counter.cue("add");
    expect(lit(counter.frame(0, FOUR), "level")).toEqual(["d"]);
    const falling = counter.frame(0.3, FOUR);
    expect(alphaOf(falling, "a")).toBeLessThan(1);
    expect(lit(counter.frame(0.2, FOUR), "level")).toEqual(["a"]);
    counter.cue("add");
    expect(lit(counter.frame(0, FOUR), "level")).toEqual(["a", "d"]);
    expect(lit(counter.frame(0.5, FOUR), "level")).toEqual(["a", "b"]);
  });

  it("arrives white and settles with Flash white", () => {
    const counter = play("counter", {
      arrive: "flash",
      arriveTime: 200,
      color: [1, 0, 0, 1],
    });
    counter.cue("add");
    expect(counter.frame(0, FOUR).color?.a?.[0]).toEqual([1, 1, 1, 1]);
    expect(counter.frame(0.3, FOUR).color?.a?.[0]).toEqual([1, 0, 0, 1]);
  });

  it("keeps its count while it has no Targets", () => {
    const counter = play("counter", { arrive: "cut" });
    counter.cue("add");
    counter.cue("add");
    counter.frame(0, FOUR);
    counter.frame(0, []);
    expect(lit(counter.frame(0, FOUR), "level")).toEqual(["a", "b"]);
  });
});

describe("Timer", () => {
  it("waits full, drains from Start, pauses, and flashes at the end", () => {
    const timer = play("timer", { duration: 4, urgent: 0 });
    expect(lit(timer.frame(1, FOUR), "level")).toEqual(FOUR);
    timer.cue("start");
    expect(lit(timer.frame(1, FOUR), "level")).toEqual(["a", "b", "c"]);
    timer.cue("pause");
    expect(lit(timer.frame(1, FOUR), "level")).toEqual(["a", "b", "c"]);
    timer.cue("resume");
    expect(lit(timer.frame(2, FOUR), "level")).toEqual(["a"]);
    // Out of time: every Target flashes, on in this frame and off a quarter second on.
    expect(lit(timer.frame(1, FOUR), "level")).toEqual(FOUR);
    expect(lit(timer.frame(0.25, FOUR), "level")).toEqual([]);
    timer.cue("reset");
    expect(lit(timer.frame(1, FOUR), "level")).toEqual(FOUR);
  });

  it("fills from empty, turns to Color end and holds", () => {
    const timer = play("timer", {
      duration: 2,
      mode: "fill",
      atEnd: "hold",
      urgent: 0,
    });
    expect(lit(timer.frame(1, FOUR), "level")).toEqual([]);
    timer.cue("start");
    const half = timer.frame(1, FOUR);
    expect(lit(half, "level")).toEqual(["a", "b"]);
    expect(half.color?.a?.[0]).toEqual([0.5, 0.5, 0, 1]);
    expect(lit(timer.frame(5, FOUR), "level")).toEqual(FOUR);
  });

  it("pulses through its last seconds", () => {
    const timer = play("timer", { duration: 10, urgent: 5 });
    timer.cue("start");
    expect(alphaOf(timer.frame(1, FOUR), "a")).toBe(1);
    timer.frame(4.5, FOUR);
    // Four seconds left is the bottom of a pulse.
    expect(alphaOf(timer.frame(0.5, FOUR), "a")).toBeCloseTo(0.35);
  });
});

describe("Reveal", () => {
  it("writes nothing until Reveal, then the color on every Target, and lets go on Hide", () => {
    const reveal = play("reveal", { style: "fade", time: 1_000 });
    expect(lit(reveal.frame(1, FOUR), "color")).toEqual([]);
    reveal.cue("reveal");
    expect(alphaOf(reveal.frame(0.5, FOUR), "a")).toBeCloseTo(0.5);
    const shown = reveal.frame(0.5, FOUR);
    expect(lit(shown, "color")).toEqual(FOUR);
    expect(shown.color?.a).toEqual([[0, 1, 0, 1], 1]);
    reveal.cue("hide");
    expect(alphaOf(reveal.frame(0.5, FOUR), "a")).toBeCloseTo(0.5);
    expect(lit(reveal.frame(0.5, FOUR), "color")).toEqual([]);
  });

  it("scatters the Targets over the time and wipes them in order", () => {
    const scatter = play("reveal", { style: "scatter", time: 1_000 });
    scatter.cue("reveal");
    const counts: number[] = [];
    for (let frame = 0; frame < 10; frame += 1)
      counts.push(lit(scatter.frame(0.1, FOUR), "color").length);
    expect(counts.at(-1)).toBe(4);
    expect(counts.some((count) => count > 0 && count < 4)).toBe(true);
    expect([...counts].sort((a, b) => a - b)).toEqual(counts);

    const wipe = play("reveal", { style: "wipe", time: 1_000 });
    wipe.cue("reveal");
    expect(lit(wipe.frame(0.3, FOUR), "color")).toEqual(["a", "b"]);
  });

  it("flashes white and settles, and Random settles on the color too", () => {
    const flash = play("reveal", { style: "flash", time: 1_000 });
    flash.cue("reveal");
    expect(flash.frame(0.001, FOUR).color?.a?.[0]).not.toEqual([0, 1, 0, 1]);
    expect(flash.frame(1, FOUR).color?.a?.[0]).toEqual([0, 1, 0, 1]);
    const random = play("reveal", { style: "random", time: 500 });
    random.cue("reveal");
    random.frame(0.25, FOUR);
    expect(random.frame(0.5, FOUR).color?.d).toEqual([[0, 1, 0, 1], 1]);
  });
});

describe("Roulette", () => {
  it("runs the laps, slows down and lands on the Winner", () => {
    const roulette = play("roulette", {
      duration: 2,
      laps: 2,
      winner: 3,
      tail: 0,
    });
    expect(lit(roulette.frame(1, FOUR), "level")).toEqual([]);
    roulette.cue("spin");
    const seen: string[] = [];
    for (let frame = 0; frame < 80; frame += 1)
      seen.push(lit(roulette.frame(0.025, FOUR), "level")[0] ?? "");
    const changes = seen.filter((key, index) => key !== seen[index - 1]);
    // Two laps of four and two more Targets to the third.
    expect(changes.length).toBe(11);
    expect(seen.at(-1)).toBe("c");
    const firstHalf = seen.slice(0, 40);
    const moved = (keys: string[]) =>
      keys.filter((key, index) => index > 0 && key !== keys[index - 1]).length;
    expect(moved(firstHalf)).toBeGreaterThan(moved(seen.slice(40)));
    // It blinks, then holds.
    expect(lit(roulette.frame(3, FOUR), "level")).toEqual(["c"]);
    roulette.cue("clear");
    expect(lit(roulette.frame(0.1, FOUR), "level")).toEqual([]);
  });

  it("picks a Target at random with Winner 0", () => {
    const roulette = play("roulette", { duration: 0.5, laps: 0, winner: 0 });
    roulette.cue("spin");
    roulette.frame(1, FOUR);
    expect(lit(roulette.frame(3, FOUR), "level").length).toBe(1);
  });
});
