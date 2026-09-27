import { describe, expect, it } from "vitest";

import panelJson from "../../../refrata-library/generic/atomic-like-panel.json" with { type: "json" };
import { run, stage } from "../commands/preset-stage.ts";
import type { LookLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import type { ValuePreset } from "../document/preset.ts";
import { presetRowValues } from "./preset-entries.ts";
import { resolveDocument } from "./resolve.ts";

/** The stage with a panel strobe, Look Layer Wash over its root linked for `color` to Preset Warm. */
function washed(): Document {
  let document = stage();
  for (const [name, payload] of [
    [
      "fixture.create",
      {
        id: "strobe",
        typeKey: "generic/atomic-like-panel",
        modeKey: "32ch",
        fixtureType: panelJson,
        name: "Strobe",
      },
    ],
    [
      "layer.create",
      { id: "wash", sceneId: "verse", name: "Wash", targets: ["strobe/root"] },
    ],
    [
      "preset.create",
      { id: "warm", name: "Warm", elements: ["strobe/backlight"] },
    ],
    [
      "preset.row.set",
      {
        presetId: "warm",
        elements: ["strobe/backlight"],
        attribute: "color",
        value: [1, 0.5, 0, 1],
      },
    ],
    [
      "link.preset",
      { presetId: "warm", addresses: ["layer/wash/row/all/color"] },
    ],
  ] as const)
    document = run(document, name, payload).document;
  return document;
}

describe("a Preset's values per Element", () => {
  it("fans a row on an Element down to its parts", () => {
    const resolved = resolveDocument(washed());
    expect(resolved.get("strobe/panel-3")?.color).toEqual([1, 0.5, 0, 1]);
  });

  it("gives a part its own row over its ancestor's, and the rest the All Elements row", () => {
    let document = run(washed(), "preset.elements.add", {
      presetId: "warm",
      refs: ["strobe/panel-3"],
    }).document;
    document = run(document, "preset.row.set", {
      presetId: "warm",
      elements: ["strobe/panel-3"],
      attribute: "color",
      value: [0, 0, 1, 1],
    }).document;
    document = run(document, "preset.elements.remove", {
      presetId: "warm",
      refs: ["strobe/backlight"],
    }).document;
    const entries = presetRowValues(
      document,
      document.layers.wash as LookLayer,
      "all",
      "color",
      document.presets.warm as ValuePreset,
    );
    expect(entries).toHaveLength(8);
    expect(entries[2]).toEqual({
      ref: "strobe/panel-3",
      label: "Strobe › Panel 3",
      value: [0, 0, 1, 1],
    });
    expect(entries[0]?.value).toBeUndefined();
    document = run(document, "preset.row.set", {
      presetId: "warm",
      elements: ["all"],
      attribute: "color",
      value: [1, 1, 1, 1],
    }).document;
    const resolved = resolveDocument(document);
    expect(resolved.get("strobe/panel-3")?.color).toEqual([0, 0, 1, 1]);
    expect(resolved.get("strobe/panel-1")?.color).toEqual([1, 1, 1, 1]);
  });
});
