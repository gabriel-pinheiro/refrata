import strobeJson from "../../../refrata-library/generic/atomic-like-panel.refrata-fixture";
import beamJson from "../../../refrata-library/generic/beam-moving-head.refrata-fixture";
import rgbJson from "../../../refrata-library/generic/rgb-3ch.refrata-fixture";
import { executeCommand } from "../command/execute.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { FixtureTypeSchema, type Mode } from "../rig/fixture-type.ts";
import { createBuiltInRegistry } from "./index.ts";

/** What the `type.*` tests share: a runner that checks every type still parses, and Installations holding library types. */
export const registry = createBuiltInRegistry();

export const BEAM = { typeKey: "generic/beam-moving-head", modeKey: "12ch" };
export const STROBE = { typeKey: "generic/atomic-like-panel", modeKey: "32ch" };
export const RGB = { typeKey: "generic/rgb-3ch", modeKey: "3ch" };

/** Runs a command that must be accepted; every type the Installation holds must still parse after it. */
export function run(document: Document, name: string, payload: unknown) {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  for (const stored of Object.values(result.document.fixtureTypes)) {
    const parsed = FixtureTypeSchema.safeParse(stored.type);
    if (!parsed.success)
      throw new Error(
        `${name} left ${stored.id} invalid: ${parsed.error.message}`,
      );
  }
  return result;
}

/** Runs an edit of a held type: accepted, and its patches never replace the whole type. */
export function edit(document: Document, name: string, payload: unknown) {
  const result = run(document, name, payload);
  for (const patch of result.patches)
    if (patch.path[0] === "fixtureTypes" && patch.path.length < 4)
      throw new Error(`${name} sent ${patch.path.join("/")} whole.`);
  return result;
}

/** The reason a command is refused. */
export function refused(
  document: Document,
  name: string,
  payload: unknown,
): string {
  const result = executeCommand(registry, document, name, payload);
  if (result.ok) throw new Error(`${name} was accepted.`);
  return result.error;
}

export function modeOf(
  document: Document,
  ref: { readonly typeKey: string; readonly modeKey: string },
): Mode {
  const mode = document.fixtureTypes[ref.typeKey]?.type.modes[ref.modeKey];
  if (mode === undefined) throw new Error(`no Mode ${ref.modeKey}`);
  return mode;
}

/** An Installation holding the beam mover, the strobe panel and the RGB par from the library, with no Fixture. */
export function held(): Document {
  let document = emptyDocument("Club");
  for (const fixtureType of [beamJson, strobeJson, rgbJson])
    document = run(document, "type.import", {
      fixtureType,
      origin: { from: "library" },
    }).document;
  return document;
}

/**
 * The same with a Par at 1, a Strobe right after it at 4 and a Beam at 36;
 * the Strobe's panel 8 is in a Set, a Layer and a Link.
 */
export function rigged(): Document {
  let document = held();
  for (const [name, payload] of [
    ["fixture.create", { id: "par", ...RGB, name: "Par" }],
    ["fixture.create", { id: "strobe", ...STROBE, name: "Strobe" }],
    ["fixture.create", { id: "beam", ...BEAM, name: "Beam" }],
    [
      "set.create",
      {
        id: "edge",
        name: "Edge",
        members: ["strobe/panel-7", "strobe/panel-8"],
      },
    ],
    ["scene.create", { id: "verse", name: "Verse" }],
    [
      "layer.create",
      {
        id: "base",
        sceneId: "verse",
        name: "Base",
        targets: ["strobe/panel-8", "par/root"],
      },
    ],
    ["controller.create", { id: "fader", kind: "number", name: "Fader" }],
    [
      "link.create",
      {
        controllerId: "fader",
        addresses: ["layer/base/row/strobe/panel-8/dimmer"],
      },
    ],
  ] as const)
    document = run(document, name, payload).document;
  return document;
}
