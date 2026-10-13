import {
  channelRows,
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
  type Document,
  type PatchedFixture,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import strobeJson from "../../../../refrata-library/generic/atomic-like-panel.refrata-fixture";
import rgbJson from "../../../../refrata-library/generic/rgb-3ch.refrata-fixture";
import { heldValues, holdsFixture, probeFixtures } from "./probe-range";

const registry = createBuiltInRegistry();

function stage(): Document {
  let document = emptyDocument("Club");
  for (const [name, payload] of [
    [
      "fixture.create",
      {
        id: "par",
        typeKey: "generic/rgb-3ch",
        modeKey: "3ch",
        fixtureType: rgbJson,
        name: "Par",
      },
    ],
    [
      "fixture.create",
      {
        id: "loose",
        typeKey: "generic/rgb-3ch",
        modeKey: "3ch",
        unpatched: true,
      },
    ],
    [
      "fixture.create",
      {
        id: "strobe",
        typeKey: "generic/atomic-like-panel",
        modeKey: "32ch",
        fixtureType: strobeJson,
      },
    ],
  ] as const) {
    const result = executeCommand(registry, document, name, payload);
    if (!result.ok) throw new Error(result.error);
    document = result.document;
  }
  return document;
}

describe("the probe", () => {
  const document = stage();
  const par = document.fixtures.par as PatchedFixture;
  const universeId = par.patch?.universeId ?? "";

  it("aims at the patched Fixtures of the type that are on the Mode", () => {
    const ids = (typeKey: string, modeKey: string): string[] =>
      probeFixtures(document.fixtures, typeKey, modeKey).map(
        (fixture) => fixture.id,
      );
    expect(ids("generic/rgb-3ch", "3ch")).toEqual(["par"]);
    expect(ids("generic/atomic-like-panel", "32ch")).toEqual(["strobe"]);
    expect(ids("generic/atomic-like-panel", "3ch")).toEqual([]);
  });

  it("holds when the tester's range is exactly the Fixture's", () => {
    const held = { universeId, address: 1, values: [0, 0, 0] };
    expect(holdsFixture(held, par, 3)).toBe(true);
    expect(holdsFixture({ ...held, values: [0, 0, 0, 0] }, par, 3)).toBe(false);
    expect(holdsFixture({ ...held, address: 2 }, par, 3)).toBe(false);
    expect(holdsFixture({ ...held, universeId: "other" }, par, 3)).toBe(false);
    expect(holdsFixture(null, par, 3)).toBe(false);
    expect(holdsFixture(held, undefined, 3)).toBe(false);
    // The Footprint grew under a held range: no longer the Fixture's.
    expect(holdsFixture(held, par, 4)).toBe(false);
  });

  it("reads a wide Channel's value most significant byte first", () => {
    const mode = document.fixtureTypes["generic/rgb-3ch"]?.type.modes["3ch"];
    if (mode === undefined) throw new Error("no Mode");
    const rows = channelRows({
      ...mode,
      channels: mode.channels.map((channel, index) =>
        index === 0 ? { ...channel, bytes: 2 as const } : channel,
      ),
    });
    expect(
      heldValues(rows, { universeId, address: 1, values: [1, 2, null, 255] }),
    ).toEqual({ red: 258, green: 0, blue: 255 });
  });
});
