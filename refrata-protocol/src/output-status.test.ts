import { emptyDocument, type Document } from "@refrata/core";
import { describe, expect, it } from "vitest";

import {
  formatOutputStatus,
  outputLabel,
  outputStatusLine,
} from "./output-status.ts";

const document = {
  ...emptyDocument("Club"),
  universes: { u: { id: "u", name: "Universe 1", order: "a" } },
  outputs: {
    o: { id: "o", universeId: "u", kind: "enttec-usb-pro", device: "any" },
    p: { id: "p", universeId: "u", kind: "anyma-udmx", device: "3-4" },
    q: { id: "q", universeId: "u", kind: "anyma-udmx", device: "3-5" },
  },
} as unknown as Document;

describe("output status", () => {
  it("names an Output by Universe and kind, its device only when another reads the same", () => {
    expect(outputLabel(document, "o")).toBe("Universe 1 · Enttec DMX USB Pro");
    expect(outputLabel(document, "p")).toBe("Universe 1 · Anyma uDMX · 3-4");
    expect(outputLabel(document, "gone")).toBe("gone");
    expect(outputLabel(undefined, "o")).toBe("o");
  });

  it("says what an Output is doing, with the reason it is not delivering", () => {
    expect(
      formatOutputStatus({
        state: "delivering",
        path: "/dev/ttyUSB0",
        fps: 39,
      }),
    ).toBe("delivering on /dev/ttyUSB0 at 39 fps");
    expect(
      formatOutputStatus({
        state: "device-missing",
        path: null,
        fps: 0,
        message: "No widget at path /dev/ttyUSB1.",
      }),
    ).toBe("device missing (No widget at path /dev/ttyUSB1.)");
    expect(formatOutputStatus({ state: "error", path: null, fps: 0 })).toBe(
      "error",
    );
    expect(
      outputStatusLine(document, "o", {
        state: "delivering",
        path: "/dev/ttyUSB0",
        fps: 39,
      }),
    ).toBe(
      "Universe 1 · Enttec DMX USB Pro: delivering on /dev/ttyUSB0 at 39 fps",
    );
  });
});
