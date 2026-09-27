import { describe, expect, it } from "vitest";

import beamJson from "../../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { applyPatches } from "../document/patch.ts";
import { createBuiltInRegistry } from "./index.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown) {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result;
}

/** A beam mover under Look Layer Base, with nothing ticked. */
function stage(): Document {
  let document = emptyDocument("Club");
  for (const [name, payload] of [
    [
      "fixture.create",
      {
        id: "beam",
        typeKey: "generic/beam-moving-head",
        modeKey: "12ch",
        fixtureType: beamJson,
        name: "Beam",
      },
    ],
    ["scene.create", { id: "verse", name: "Verse" }],
    [
      "layer.create",
      { id: "base", sceneId: "verse", name: "Base", targets: ["beam/root"] },
    ],
  ] as const)
    document = run(document, name, payload).document;
  return document;
}

describe("layer.aim.set", () => {
  it("ticks pan and tilt on in one step, keeping a row already there", () => {
    let document = stage();
    document = run(document, "layer.row.set", {
      layerId: "base",
      targets: ["beam/root"],
      attribute: "pan",
      value: 40,
    }).document;
    const ticked = run(document, "layer.aim.set", {
      layerId: "base",
      targets: ["beam/root", "all"],
    });
    expect(ticked.label).toBe("Set Aim");
    expect(ticked.document.layers.base).toMatchObject({
      rows: { "beam/root": { pan: { value: 40 }, tilt: { value: 0 } } },
      all: { pan: { value: 0 }, tilt: { value: 0 } },
    });
    expect(applyPatches(ticked.document, ticked.inverse)).toEqual(document);
  });

  it("refuses a Target without both axes, writing nothing", () => {
    const result = executeCommand(registry, stage(), "layer.aim.set", {
      layerId: "base",
      targets: ["nope/root"],
    });
    expect(result.ok).toBe(false);
  });
});
