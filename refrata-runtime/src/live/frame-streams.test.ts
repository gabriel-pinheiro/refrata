import { describe, expect, it, vi } from "vitest";

import { FrameStream, type FrameMessage } from "./frame-streams.ts";

function frame(...set: readonly (readonly [slot: number, byte: number])[]) {
  const bytes = new Uint8Array(512);
  for (const [slot, byte] of set) bytes[slot] = byte;
  return bytes;
}

describe("FrameStream", () => {
  it("sends every byte first, then only the addresses that changed", () => {
    vi.useFakeTimers();
    const sent: FrameMessage[] = [];
    const stream = new FrameStream((message) => sent.push(message), 20);
    stream.setUniverses(["u1"], new Map([["u1", frame([0, 255])]]));
    expect(sent).toHaveLength(1);
    expect(sent[0]?.full).toBe(true);
    expect(Object.keys(sent[0]?.bytes ?? {})).toHaveLength(512);
    expect(sent[0]?.bytes["1"]).toBe(255);

    stream.update(new Map([["u1", frame([0, 255], [3, 12])]]));
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(50);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({
      universeId: "u1",
      full: false,
      bytes: { 4: 12 },
    });

    // A still frame sends nothing.
    stream.update(new Map([["u1", frame([0, 255], [3, 12])]]));
    vi.advanceTimersByTime(50);
    expect(sent).toHaveLength(2);
    stream.close();
    vi.useRealTimers();
  });

  it("stays quiet for a Universe with no frame and full again after a restart", () => {
    const sent: FrameMessage[] = [];
    const stream = new FrameStream((message) => sent.push(message), 20);
    stream.setUniverses(["gone"], new Map());
    expect(sent).toHaveLength(0);
    stream.setUniverses(["u1"], new Map([["u1", frame()]]));
    expect(sent).toHaveLength(1);
    stream.restart();
    stream.flush();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.full).toBe(true);
    stream.setUniverses([], new Map());
    expect(stream.active).toBe(false);
  });
});
