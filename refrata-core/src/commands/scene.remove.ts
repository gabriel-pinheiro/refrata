import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { sceneLayers } from "../document/layers.ts";
import type { Patch } from "../document/patch.ts";
import { removalWarnings } from "../document/removal.ts";
import { dropLayerReferences } from "./layer.remove.ts";

/** The active Scene cannot go: the Outputs are showing it. Play another first. */
export const sceneRemove = defineCommand({
  name: "scene.remove",
  kind: "authoring",
  description: "Remove a Scene and every Layer in it.",
  payload: z.object({ sceneId: z.string().min(1) }).strict(),
  label: () => "Remove Scene",
  apply({ document, payload }) {
    const scene = document.scenes[payload.sceneId];
    if (scene === undefined)
      return rejected(`Scene “${payload.sceneId}” does not exist.`);
    if (document.installation.activeScene === scene.id)
      return rejected(
        `“${scene.name}” is the active Scene. Play another Scene first.`,
      );
    const layers = sceneLayers(document.layers, scene.id);
    const patches: Patch[] = dropLayerReferences(document, [
      `scene/${scene.id}/`,
      ...layers.map((layer) => `layer/${layer.id}/`),
    ]);
    const warnings = removalWarnings(document, patches, scene.name);
    for (const layer of layers)
      patches.push({ op: "remove", path: ["layers", layer.id] });
    patches.push({ op: "remove", path: ["scenes", scene.id] });
    return accepted(patches, undefined, warnings);
  },
});
