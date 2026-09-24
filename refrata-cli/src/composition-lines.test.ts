import {
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
  type Document,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import rgbJson from "../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import strobeJson from "../../refrata-library/generic/atomic-like-panel.json" with { type: "json" };
import {
  formatRowValue,
  formatScenes,
  formatSets,
  formatStack,
} from "./composition-lines.ts";

const registry = createBuiltInRegistry();

export function stageLook(): Document {
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
        id: "strobe",
        typeKey: "generic/atomic-like-panel",
        modeKey: "32ch",
        fixtureType: strobeJson,
        name: "Strobe",
      },
    ],
    [
      "set.create",
      { id: "wash", name: "Wash", members: ["par/root", "strobe/panel-1"] },
    ],
    ["set.create", { id: "sg", kind: "group", name: "Folder" }],
    ["scene.create", { id: "verse", name: "Verse" }],
    ["scene.create", { id: "chorus", name: "Chorus" }],
    [
      "layer.create",
      {
        id: "base",
        sceneId: "verse",
        name: "Base",
        targets: ["par/root", "strobe/panel-3", "set:wash"],
      },
    ],
    [
      "layer.row.set",
      {
        layerId: "base",
        targets: ["par/root"],
        attribute: "dimmer",
        value: 0.4,
      },
    ],
    [
      "layer.row.set",
      {
        layerId: "base",
        targets: ["par/root"],
        attribute: "color",
        value: [0, 1, 0, 1],
      },
    ],
    [
      "layer.row.set",
      {
        layerId: "base",
        targets: ["all"],
        attribute: "dimmer",
        value: 0.2,
      },
    ],
    [
      "layer.create",
      { id: "g", kind: "group", sceneId: "verse", name: "Folder" },
    ],
    [
      "layer.create",
      {
        id: "top",
        sceneId: "verse",
        name: "Top",
        parentId: "g",
        targets: null,
      },
    ],
    ["layer.update", { layerId: "g", enabled: false, opacity: 0.5 }],
    ["address.edit", { address: "layer/top/fade/in/time", value: 2 }],
    ["address.edit", { address: "layer/top/fade/out/time", value: 0.5 }],
    ["address.edit", { address: "layer/top/fade/out/curve", value: "bounce" }],
  ] as const) {
    const result = executeCommand(registry, document, name, payload);
    if (!result.ok) throw new Error(result.error);
    document = result.document;
  }
  return document;
}

describe("composition lines", () => {
  it("lists Scenes with their Layer counts and the playing one", () => {
    expect(formatScenes(stageLook())).toEqual([
      "Scene “Verse”  verse  3 Layers  [playing]",
      "Scene “Chorus”  chorus  0 Layers",
    ]);
  });

  it("shows a stack topmost first with Targets, rows and disabled Layers", () => {
    expect(formatStack(stageLook(), "verse")).toEqual([
      "Group “Folder”  g  opacity 50%  [off]",
      "  Look “Top”  top  opacity 100%  normal  fade in 2 s, out 0.5 s bounce  No Targets  [off]",
      "Look “Base”  base  opacity 100%  normal  targets: Par, Strobe › Panel 3, Wash",
      "  All Targets: dimmer 20%",
      "  Par: dimmer 40% · color #00ff00",
    ]);
  });

  it("lists Sets in their Groups with members named by Fixture and Element", () => {
    expect(formatSets(stageLook())).toEqual([
      "Group “Folder”  sg",
      "Set “Wash”  wash  2 members: Par, Strobe › Panel 1",
    ]);
  });

  it("formats values in their Attribute's units", () => {
    expect(formatRowValue("dimmer", 0.4)).toBe("40%");
    expect(formatRowValue("strobe", 12)).toBe("12 Hz");
    expect(formatRowValue("pan", -12.5)).toBe("-12.50 °");
    expect(formatRowValue("shutter", "closed")).toBe("closed");
    expect(formatRowValue("color", [1, 0.5, 0, 1])).toBe("#ff8000");
  });
});
