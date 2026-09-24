import type { Output, Table, Universe } from "@refrata/core";
import { describe, expect, it } from "vitest";

import { countUniverseWarnings, universeWarning } from "./universe-warning.ts";

const universes = {
  front: { id: "front", name: "Front", order: "a0" },
  floor: { id: "floor", name: "Floor", order: "a1" },
} as unknown as Record<"front" | "floor", Universe>;
const outputs = {
  o: { id: "o", universeId: "front", kind: "enttec-usb-pro", device: "any" },
} as unknown as Table<Output>;

describe("universeWarning", () => {
  it("warns a Universe no Output delivers", () => {
    expect(universeWarning(universes.front, outputs)).toBeUndefined();
    expect(universeWarning(universes.floor, outputs)?.label).toBe("No Output");
  });

  it("counts the rows that would warn", () => {
    expect(countUniverseWarnings(universes, outputs)).toBe(1);
    expect(countUniverseWarnings(universes, {})).toBe(2);
  });
});
