import { describe, expect, it, vi } from "vitest";

import { PoseStream, type PoseMessage } from "./pose-streams.ts";

describe("PoseStream", () => {
  it("tells every asked Layer its pose at once, then only changes, at the stream rate", () => {
    vi.useFakeTimers();
    const sent: PoseMessage[] = [];
    const stream = new PoseStream((message) => sent.push(message), 20);
    stream.setLayers(["wipe", "idle"], new Map([["wipe", { centre: 0.1 }]]));
    expect(sent).toEqual([
      { layerId: "wipe", pose: { centre: 0.1 } },
      { layerId: "idle", pose: null },
    ]);

    stream.update(new Map([["wipe", { centre: 0.2 }]]));
    expect(sent).toHaveLength(2);
    vi.advanceTimersByTime(50);
    expect(sent).toHaveLength(3);
    expect(sent[2]).toEqual({ layerId: "wipe", pose: { centre: 0.2 } });

    // A still pose sends nothing; a list is compared by content.
    stream.update(new Map([["wipe", { centre: 0.2 }]]));
    vi.advanceTimersByTime(50);
    expect(sent).toHaveLength(3);
    stream.update(new Map([["wipe", { radii: [0.5] }]]));
    vi.advanceTimersByTime(50);
    stream.update(new Map([["wipe", { radii: [0.5] }]]));
    vi.advanceTimersByTime(50);
    expect(sent).toHaveLength(4);
    stream.close();
    vi.useRealTimers();
  });

  it("says null once when an instance goes and repeats everything after a restart", () => {
    const sent: PoseMessage[] = [];
    const stream = new PoseStream((message) => sent.push(message), 20);
    stream.setLayers(["wipe"], new Map([["wipe", { centre: 0 }]]));
    stream.update(new Map());
    stream.flush();
    stream.flush();
    expect(sent).toEqual([
      { layerId: "wipe", pose: { centre: 0 } },
      { layerId: "wipe", pose: null },
    ]);
    stream.restart();
    stream.flush();
    expect(sent).toHaveLength(3);
    expect(stream.active).toBe(true);
    stream.close();
    expect(stream.active).toBe(false);
  });
});
