import {
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
  type Document,
  type LookLayer,
  type ValuePreset,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import beamJson from "../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import { aimReport, formatAim } from "./aim-lines.ts";
import { formatStack } from "./composition-lines.ts";
import { resolveAddressNames, resolvePayloadNames } from "./names.ts";
import { formatPreset, formatPresets } from "./preset-lines.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown): Document {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

/** Two beams under Look Layer Spot, its All Targets Aim linked to Preset Table, which holds Left at 10° and 20° and nothing for Right. */
function stage(): Document {
  let document = emptyDocument("Club");
  for (const [name, payload] of [
    ...(["Left", "Right"] as const).map(
      (mover) =>
        [
          "fixture.create",
          {
            id: mover.toLowerCase(),
            typeKey: "generic/beam-moving-head",
            modeKey: "12ch",
            fixtureType: beamJson,
            name: mover,
          },
        ] as const,
    ),
    ["scene.create", { id: "verse", name: "Verse" }],
    [
      "layer.create",
      {
        id: "spot",
        sceneId: "verse",
        name: "Spot",
        targets: ["left/root", "right/root"],
      },
    ],
    ["preset.create", { id: "table", name: "Table", elements: ["left/root"] }],
    [
      "aim.edit",
      {
        pan: "preset/table/row/left/root/pan",
        tilt: "preset/table/row/left/root/tilt",
        value: { pan: 10, tilt: 20 },
      },
    ],
    [
      "link.preset",
      {
        presetId: "table",
        addresses: ["layer/spot/row/all/pan", "layer/spot/row/all/tilt"],
      },
    ],
  ] as const)
    document = run(document, name, payload);
  return document;
}

describe("Presets as the CLI shows them", () => {
  it("lists the Presets and shows one with its rows and the rows linked to it", () => {
    const document = stage();
    expect(formatPresets(document)).toEqual([
      "Preset “Table”  table  1 Element",
    ]);
    expect(
      formatPreset(document, document.presets.table as ValuePreset),
    ).toEqual([
      "Preset “Table”  table  1 Element",
      "  All Elements: no rows",
      "  Left  left/root: pan 10 °, tilt 20 °",
      "  linked to 2 rows:",
      "    layer/spot/row/all/pan  Spot · All Targets",
      "    layer/spot/row/all/tilt  Spot · All Targets",
    ]);
  });

  it("says under a Layer and an Aim what each Element takes, naming the one with no entry", () => {
    const document = stage();
    expect(formatStack(document, "verse")).toContain(
      "  All Targets: pan from Preset “Table” (Left 10 °, Right no entry)",
    );
    const owner = { layer: document.layers.spot as LookLayer, ref: "all" };
    expect(formatAim(document, owner, aimReport(document, owner))).toEqual([
      "Aim of All Targets on “Spot”",
      "  pan   linked to Preset “Table”  (within -270.0° to 270.0°)",
      "    Left   10.0°",
      "    Right  no entry, released",
      "  tilt  linked to Preset “Table”  (within -90.0° to 90.0°)",
      "    Left   20.0°",
      "    Right  no entry, released",
    ]);
  });

  it("reports the Aim a Preset holds for an Element", () => {
    const document = stage();
    const owner = {
      preset: document.presets.table as ValuePreset,
      ref: "left/root",
    };
    expect(formatAim(document, owner, aimReport(document, owner))).toEqual([
      "Aim of Left on Preset “Table”",
      "  pan   10.0°  (within -270.0° to 270.0°)",
      "  tilt  20.0°  (within -90.0° to 90.0°)",
    ]);
  });

  it("reads a Preset and its Elements by name in Addresses and payloads", () => {
    const document = stage();
    expect(resolveAddressNames(document, "preset/Table/row/Left/pan")).toBe(
      "preset/table/row/left/root/pan",
    );
    expect(resolveAddressNames(document, "preset/Table/row/all/color")).toBe(
      "preset/table/row/all/color",
    );
    expect(
      resolvePayloadNames(document, "preset.row.set", {
        presetId: "Table",
        elements: ["Left", "all"],
        attribute: "pan",
      }),
    ).toEqual({
      presetId: "table",
      elements: ["left/root", "all"],
      attribute: "pan",
    });
    expect(
      resolvePayloadNames(document, "preset.create", {
        name: "Wall",
        elements: ["Right"],
        after: "Table",
      }),
    ).toEqual({ name: "Wall", elements: ["right/root"], after: "table" });
  });
});
