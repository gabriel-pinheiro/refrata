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

/** A beam mover under Look Layer Base with its Aim ticked on and pan linked to Controller Sweep. */
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
    ["layer.aim.set", { layerId: "base", targets: ["beam/root"] }],
    [
      "controller.create",
      {
        id: "sweep",
        kind: "number",
        name: "Sweep",
        addresses: ["layer/base/row/beam/root/pan"],
      },
    ],
  ] as const)
    document = run(document, name, payload).document;
  return document;
}

describe("layer.aim.release", () => {
  it("releases both rows and their Links in one step, undone as one", () => {
    const document = stage();
    const released = run(document, "layer.aim.release", {
      layerId: "base",
      targets: ["beam/root"],
    });
    expect(released.label).toBe("Release Aim");
    const layer = released.document.layers.base;
    expect(layer?.kind === "look" ? layer.rows["beam/root"] : "?").toEqual({});
    expect(Object.keys(released.document.links)).toEqual([]);
    expect(applyPatches(released.document, released.inverse)).toEqual(document);
  });
});
