import { executeCommand } from "../command/execute.ts";
import type { CommandRegistry } from "../command/registry.ts";
import { generateId } from "../ids.ts";
import { setRef } from "./composition.ts";
import { emptyDocument, type Document } from "./document.ts";

/** The names the starter Installation's entities carry. */
export const STARTER = {
  set: "All",
  scene: "Scene 1",
  layer: "Base",
} as const;

/**
 * A new Installation that lights the first Fixture patched into it: the
 * Universe every empty Document has, a rule Fixture Set "All" whose one
 * empty Rule reads "every Fixture", Scene 1, playing, and on it a Look
 * Layer "Base" targeting that Set with Dimmer at 100 % and Color white.
 * It is built by running the commands, so it follows their defaults (the
 * first Scene plays, a Layer targets the Set named "All") and takes fresh
 * ids each time. Nothing enters undo history; the caller starts it clean.
 * A rejected step throws.
 */
export function starterDocument(
  name: string,
  registry: CommandRegistry,
): Document {
  const setId = generateId("fixtureSet");
  const sceneId = generateId("scene");
  const layerId = generateId("layer");
  const targets = [setRef(setId)];
  const steps: readonly (readonly [string, unknown])[] = [
    ["set.create", { id: setId, kind: "set", name: STARTER.set, rules: [[]] }],
    ["scene.create", { id: sceneId, name: STARTER.scene }],
    [
      "layer.create",
      { id: layerId, kind: "look", sceneId, name: STARTER.layer },
    ],
    ["layer.row.set", { layerId, targets, attribute: "dimmer", value: 1 }],
    [
      "layer.row.set",
      { layerId, targets, attribute: "color", value: [1, 1, 1, 1] },
    ],
  ];
  let document = emptyDocument(name);
  for (const [command, payload] of steps) {
    const result = executeCommand(registry, document, command, payload);
    if (!result.ok)
      throw new Error(
        `The starter Installation failed at “${command}”: ${result.error}`,
      );
    document = result.document;
  }
  return document;
}
