import { emptyDocument, type Document } from "@refrata/core";
import type { LiveState } from "@refrata/protocol";
import { describe, expect, it } from "vitest";

import { formatLiveStatus, liveStatus, outputLabel } from "./live-status.ts";

const base: LiveState = {
  osc: { port: 9100, listeners: 2 },
  outputs: {},
  dmx: { rateHz: 40, fps: 40 },
  fixtureTypes: {},
};

describe("liveStatus", () => {
  it("reports the OSC door, the loop and every Output", () => {
    expect(formatLiveStatus(liveStatus(base))).toEqual([
      "OSC on port 9100, 2 OSCQuery listeners",
      "DMX at 40 Hz, 40 fps",
    ]);
    expect(
      formatLiveStatus(
        liveStatus({
          ...base,
          osc: { port: 9100, listeners: 1 },
          outputs: {
            o: { state: "delivering", path: "/dev/ttyUSB0", fps: 39 },
            p: {
              state: "device-missing",
              path: null,
              fps: 0,
              message: "No serial DMX widget found.",
            },
          },
        }),
      ),
    ).toEqual([
      "OSC on port 9100, 1 OSCQuery listener",
      "DMX at 40 Hz, 40 fps",
      "Output o: delivering on /dev/ttyUSB0 at 39 fps",
      "Output p: device missing (No serial DMX widget found.)",
    ]);
  });

  it("names an Output as Studio does, by Universe and kind", () => {
    const document = {
      ...emptyDocument("Club"),
      universes: { u: { id: "u", name: "Universe 1", order: "a" } },
      outputs: {
        o: {
          id: "o",
          universeId: "u",
          kind: "enttec-usb-pro",
          device: "any",
        },
        p: {
          id: "p",
          universeId: "u",
          kind: "anyma-udmx",
          device: "3-4",
        },
        q: {
          id: "q",
          universeId: "u",
          kind: "anyma-udmx",
          device: "3-5",
        },
      },
    } as unknown as Document;
    expect(outputLabel(document, "o")).toBe("Universe 1 · Enttec DMX USB Pro");
    expect(outputLabel(document, "p")).toBe("Universe 1 · Anyma uDMX · 3-4");
    expect(outputLabel(document, "gone")).toBe("gone");
    expect(outputLabel(undefined, "o")).toBe("o");
    expect(
      formatLiveStatus(
        liveStatus({
          ...base,
          outputs: {
            o: { state: "delivering", path: "/dev/ttyUSB0", fps: 39 },
          },
        }),
        document,
      )[2],
    ).toBe(
      "Output Universe 1 · Enttec DMX USB Pro: delivering on /dev/ttyUSB0 at 39 fps",
    );
  });

  it("says when the door is closed", () => {
    expect(
      formatLiveStatus(
        liveStatus({ ...base, osc: { port: null, listeners: 0 } }),
      )[0],
    ).toBe("OSC is off.");
  });
});
