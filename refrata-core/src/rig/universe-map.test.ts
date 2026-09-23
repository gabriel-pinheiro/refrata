import { describe, expect, it } from "vitest";

import moverJson from "../../../refrata-library/generic/moving-head.json" with { type: "json" };
import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import { createBuiltInRegistry } from "../commands/index.ts";
import { executeCommand } from "../command/execute.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { channelLabel, universeMap, universeRuns } from "./universe-map.ts";

function stage(): Document {
  const registry = createBuiltInRegistry();
  let document = emptyDocument("Club");
  const steps: readonly (readonly [string, unknown])[] = [
    [
      "fixture.create",
      {
        id: "par",
        name: "Par",
        typeKey: "generic/rgb-3ch",
        modeKey: "3ch",
        fixtureType: rgbJson,
        address: 4,
      },
    ],
    [
      "fixture.create",
      {
        id: "head",
        name: "Head",
        typeKey: "generic/moving-head",
        modeKey: "10ch",
        fixtureType: moverJson,
        address: 10,
      },
    ],
    [
      "fixture.create",
      {
        id: "spare",
        name: "Spare",
        typeKey: "generic/rgb-3ch",
        modeKey: "3ch",
        fixtureType: rgbJson,
        unpatched: true,
      },
    ],
  ];
  for (const [name, payload] of steps) {
    const result = executeCommand(registry, document, name, payload);
    if (!result.ok) throw new Error(result.error);
    document = result.document;
  }
  return document;
}

describe("universeMap", () => {
  const document = stage();
  const universeId = Object.keys(document.universes)[0] ?? "";

  it("says which Fixture and Channel each address carries", () => {
    const map = universeMap(document, universeId);
    expect(map.has(3)).toBe(false);
    const green = map.get(5);
    expect(green?.fixture.id).toBe("par");
    expect(green?.channelKey).toBe("green");
    expect([green?.start, green?.end]).toEqual([4, 6]);
    expect(map.has(7)).toBe(false);
    const pan = map.get(10);
    const panFine = map.get(11);
    expect([pan?.channelKey, pan?.byte, pan?.bytes]).toEqual(["pan", 1, 2]);
    expect([panFine?.channelKey, panFine?.byte]).toEqual(["pan", 2]);
    expect([pan?.start, pan?.end]).toEqual([10, 19]);
    expect(map.has(20)).toBe(false);
    expect([...map.values()].some((o) => o.fixture.id === "spare")).toBe(false);
  });

  it("labels a multi-byte Channel by byte", () => {
    const map = universeMap(document, universeId);
    expect(channelLabel(map.get(5)!)).toBe("green");
    expect(channelLabel(map.get(11)!)).toBe("pan 2");
  });

  it("lists the Universe as Fixture runs and free gaps", () => {
    expect(
      universeRuns(document, universeId).map((run) => [
        run.start,
        run.end,
        run.fixture?.name,
      ]),
    ).toEqual([
      [1, 3, undefined],
      [4, 6, "Par"],
      [7, 9, undefined],
      [10, 19, "Head"],
      [20, 512, undefined],
    ]);
  });

  it("is one free run for an empty Universe", () => {
    expect(universeRuns(emptyDocument("N"), "nowhere")).toEqual([
      { start: 1, end: 512, fixture: undefined },
    ]);
  });
});
