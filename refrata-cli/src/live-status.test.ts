import type { LiveState } from "@refrata/protocol";
import { describe, expect, it } from "vitest";

import { formatLiveStatus, liveStatus } from "./live-status.ts";

describe("liveStatus", () => {
  it("reports the OSC door with its listener count", () => {
    const live: LiveState = { osc: { port: 9100, listeners: 2 } };
    expect(liveStatus(live)).toEqual({ osc: { port: 9100, listeners: 2 } });
    expect(formatLiveStatus(liveStatus(live))).toEqual([
      "OSC on port 9100, 2 OSCQuery listeners",
    ]);
    expect(
      formatLiveStatus(liveStatus({ osc: { port: 9100, listeners: 1 } })),
    ).toEqual(["OSC on port 9100, 1 OSCQuery listener"]);
  });

  it("says when the door is closed", () => {
    expect(
      formatLiveStatus(liveStatus({ osc: { port: null, listeners: 0 } })),
    ).toEqual(["OSC is off."]);
  });
});
