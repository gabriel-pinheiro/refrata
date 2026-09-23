import {
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
  type Document,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import rgbJson from "../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import strobeJson from "../../refrata-core/test-fixtures/atomic-like-panel.json" with { type: "json" };
import {
  formatFixtures,
  formatLibrary,
  formatUniverseMap,
  universeMapRuns,
} from "./rig-lines.ts";

const registry = createBuiltInRegistry();

function stage(): Document {
  let document = emptyDocument("Club");
  const steps: readonly (readonly [string, unknown])[] = [
    ["fixture.create", { id: "fx_g", kind: "group", name: "Truss" }],
    [
      "fixture.create",
      {
        id: "fx_p",
        name: "Par",
        parentId: "fx_g",
        typeKey: "generic/rgb-3ch",
        modeKey: "3ch",
        fixtureType: rgbJson,
      },
    ],
    [
      "fixture.create",
      {
        id: "fx_s",
        name: "Strobe",
        typeKey: "generic/atomic-like-panel",
        modeKey: "32ch",
        fixtureType: strobeJson,
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

describe("Rig lines", () => {
  it("lists Fixtures in Groups with their Patch and Elements", () => {
    // A create lands first, so the Strobe precedes the Group it was not put in.
    const lines = formatFixtures(stage());
    expect(lines[0]).toBe(
      "Fixture “Strobe”  fx_s  generic/atomic-like-panel  unpatched (32ch, 32 channels)  [root generic/atomic-like-panel]",
    );
    expect(lines[1]).toBe("  Backlight  fx_s/backlight  [backlight]");
    expect(lines[2]).toBe(
      "    Panel 1  fx_s/panel-1  dimmer, color  [panel-1 panel odd bottom]",
    );
    expect(lines[19]).toBe("Group “Truss”  fx_g");
    expect(lines[20]).toBe(
      "  Fixture “Par”  fx_p  generic/rgb-3ch  Universe 1 @ 1 (3ch, 3 channels)  [root generic/rgb-3ch]",
    );
    expect(lines).toHaveLength(3 + 18);
  });

  it("lists the library one type per line", () => {
    expect(
      formatLibrary([
        {
          key: "generic/rgb-3ch",
          manufacturer: "Generic",
          model: "RGB 3ch",
          modes: [{ key: "3ch", name: "3ch", footprint: 3 }],
          source: "library",
        },
      ]),
    ).toEqual(["generic/rgb-3ch          Generic RGB 3ch  modes: 3ch (3ch)"]);
  });
});

describe("formatUniverseMap", () => {
  it("prints each Fixture's run and the free gaps, bytes on a gap only when forced", () => {
    const document = stage();
    const universeId = Object.keys(document.universes)[0] ?? "";
    const frame = new Array<number>(512).fill(0);
    frame[0] = 255;
    frame[2] = 12;
    frame[10] = 7;
    const runs = universeMapRuns(document, universeId, frame);
    expect(
      runs.map((run) => [run.start, run.end, run.fixture?.name ?? null]),
    ).toEqual([
      [1, 3, "Par"],
      [4, 512, null],
    ]);
    expect(formatUniverseMap(runs)).toEqual([
      "1-3      Par (3ch, 3 channels)  255 0 12",
      "4-512    free                   <7x 0> 7 <501x 0>",
    ]);
    expect(
      formatUniverseMap(
        universeMapRuns(document, universeId, new Array<number>(512).fill(0)),
      ),
    ).toEqual(["1-3      Par (3ch, 3 channels)  <3x 0>", "4-512    free"]);
  });
});
