import { describe, expect, it } from "vitest";

import { FrameDelay } from "./frame-delay.ts";

/** One Universe's frame whose first slot says which tick made it. */
const frames = (tick: number): ReadonlyMap<string, Uint8Array> =>
  new Map([["u", Uint8Array.of(tick)]]);

/** Which tick's frames come out at each of `times`, with `delayMs` at each. */
function run(
  delay: FrameDelay,
  times: readonly number[],
  delayMs: number | ((tick: number) => number),
): (number | undefined)[] {
  return times.map(
    (now, tick) =>
      delay
        .step(
          frames(tick),
          now,
          typeof delayMs === "number" ? delayMs : delayMs(tick),
        )
        ?.get("u")?.[0],
  );
}

describe("FrameDelay", () => {
  it("passes frames straight through with no delay", () => {
    expect(run(new FrameDelay(12.5), [0, 25, 50], 0)).toEqual([0, 1, 2]);
  });

  it("holds each frame for the delay, sending nothing until the first is due", () => {
    const times = Array.from({ length: 9 }, (_, tick) => tick * 25);
    expect(run(new FrameDelay(12.5), times, 150)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      0,
      1,
      2,
    ]);
  });

  it("rounds the delay to whole frames and shrugs off a tick that comes early or late", () => {
    // 140 ms at 40 Hz is nearer six frames than five.
    expect(
      run(new FrameDelay(12.5), [0, 25, 50, 75, 100, 125, 150], 140),
    ).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      0,
    ]);
    expect(run(new FrameDelay(12.5), [0, 24, 51, 74, 77, 102], 50)).toEqual([
      undefined,
      undefined,
      0,
      1,
      undefined,
      2,
    ]);
  });

  it("sends only the newest due frame after a stall", () => {
    expect(run(new FrameDelay(12.5), [0, 25, 50, 200, 225], 50)).toEqual([
      undefined,
      undefined,
      0,
      2,
      undefined,
    ]);
  });

  it("follows a delay changed while frames are held", () => {
    const delayMs = (tick: number): number =>
      tick < 3 ? 50 : tick < 5 ? 0 : 50;
    expect(
      run(new FrameDelay(12.5), [0, 25, 50, 75, 100, 125, 150, 175], delayMs),
    ).toEqual([undefined, undefined, 0, 3, 4, undefined, undefined, 5]);
  });

  it("forgets held frames when cleared", () => {
    const delay = new FrameDelay(12.5);
    run(delay, [0, 25], 50);
    delay.clear();
    expect(delay.step(frames(9), 50, 50)).toBeUndefined();
    expect(delay.step(frames(10), 100, 50)?.get("u")?.[0]).toBe(9);
  });
});
