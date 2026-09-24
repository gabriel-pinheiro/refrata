import { describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { createBuiltInRegistry } from "./index.ts";

const registry = createBuiltInRegistry();

function apply(steps: readonly [string, unknown][]): Document {
  let document = emptyDocument("Club");
  for (const [name, payload] of steps) {
    const result = executeCommand(registry, document, name, payload);
    if (!result.ok) throw new Error(result.error);
    document = result.document;
  }
  return document;
}

function failure(document: Document, name: string, payload: unknown): string {
  const result = executeCommand(registry, document, name, payload);
  if (result.ok) throw new Error(`${name} was accepted.`);
  return result.error;
}

const document = apply([
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
      id: "spot",
      typeKey: "generic/rgb-3ch",
      modeKey: "3ch",
      fixtureType: rgbJson,
      name: "Spot",
    },
  ],
  ["scene.create", { id: "s", name: "Verse" }],
  [
    "layer.create",
    { id: "base", sceneId: "s", name: "Base", targets: ["par/root"] },
  ],
  [
    "layer.create",
    {
      id: "wave",
      sceneId: "s",
      name: "Breathe",
      kind: "visual",
      visual: "lfo",
    },
  ],
  ["layer.create", { id: "g", sceneId: "s", name: "Pack", kind: "group" }],
  ["set.create", { id: "wall", name: "Wall", members: ["par/root"] }],
  ["set.create", { id: "sg", name: "Stage", kind: "group" }],
]);

describe("wrong-kind refusals", () => {
  it("name the Layer and say what it is instead", () => {
    expect(
      failure(document, "layer.row.set", {
        layerId: "wave",
        targets: ["all"],
        attribute: "dimmer",
        value: 1,
      }),
    ).toBe("“Breathe” is a Visual Layer, not a Look Layer.");
    expect(
      failure(document, "layer.visual.set", { layerId: "base", visual: "lfo" }),
    ).toBe("“Base” is a Look Layer, not a Visual Layer.");
    expect(failure(document, "layer.ungroup", { layerId: "base" })).toBe(
      "“Base” is a Look Layer, not a Group.",
    );
    expect(
      failure(document, "layer.targets.remove", {
        layerId: "g",
        targets: ["par/root"],
      }),
    ).toBe("“Pack” is a Group; it has no Targets.");
    expect(
      failure(document, "layer.row.release", {
        layerId: "layer_gone",
        targets: ["all"],
        attribute: "dimmer",
      }),
    ).toBe("No Layer “layer_gone”.");
  });

  it("name a Target or a member by its label, not its ref", () => {
    expect(
      failure(document, "layer.row.set", {
        layerId: "base",
        targets: ["spot/root"],
        attribute: "dimmer",
        value: 1,
      }),
    ).toBe("“Spot” is not a Target of “Base”.");
    expect(
      failure(document, "set.members.move", {
        setId: "wall",
        ref: "spot/root",
        after: null,
      }),
    ).toBe("“Spot” is not a member of “Wall”.");
  });

  it("name a Group of Fixture Sets", () => {
    expect(
      failure(document, "set.members.add", {
        setId: "sg",
        refs: ["par/root"],
      }),
    ).toBe("“Stage” is a Group, not a Fixture Set.");
  });
});
