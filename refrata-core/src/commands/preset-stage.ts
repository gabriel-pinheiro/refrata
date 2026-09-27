import beamJson from "../../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { createBuiltInRegistry } from "./index.ts";

/** What the Preset tests share: a registry, a runner that throws on refusal, and a small rig. */
export const registry = createBuiltInRegistry();

export function run(document: Document, name: string, payload: unknown) {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result;
}

export function refused(
  document: Document,
  name: string,
  payload: unknown,
): string {
  const result = executeCommand(registry, document, name, payload);
  if (result.ok) throw new Error(`${name} was accepted.`);
  return result.error;
}

/**
 * Two beam movers, Left and Right, in the list Set Movers; Scene Verse is
 * playing with Look Layer Spot over the Set and nothing ticked.
 */
export function stage(): Document {
  let document = emptyDocument("Club");
  const mover = (id: string, name: string) =>
    [
      "fixture.create",
      {
        id,
        typeKey: "generic/beam-moving-head",
        modeKey: "12ch",
        fixtureType: beamJson,
        name,
      },
    ] as const;
  for (const [name, payload] of [
    mover("left", "Left"),
    mover("right", "Right"),
    [
      "set.create",
      { id: "movers", name: "Movers", members: ["left/root", "right/root"] },
    ],
    ["scene.create", { id: "verse", name: "Verse" }],
    [
      "layer.create",
      { id: "spot", sceneId: "verse", name: "Spot", targets: ["set:movers"] },
    ],
  ] as const)
    document = run(document, name, payload).document;
  return {
    ...document,
    installation: {
      ...document.installation,
      activeScene: "verse",
    },
  };
}

/** The stage with Preset Table: Left at 10°/20°, Right at -30°/40°. */
export function withTable(): Document {
  let document = run(stage(), "preset.create", {
    id: "table",
    name: "Table",
    elements: ["set:movers"],
  }).document;
  for (const [element, pan, tilt] of [
    ["left/root", 10, 20],
    ["right/root", -30, 40],
  ] as const)
    document = run(document, "aim.edit", {
      pan: `preset/table/row/${element}/pan`,
      tilt: `preset/table/row/${element}/tilt`,
      value: { pan, tilt },
    }).document;
  return document;
}
