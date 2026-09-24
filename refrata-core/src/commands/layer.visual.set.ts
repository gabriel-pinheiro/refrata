import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { frameFittingTargets } from "../document/geometry.ts";
import type { Patch } from "../document/patch.ts";
import { removalWarnings } from "../document/removal.ts";
import { defaultBindings } from "../document/visual-layers.ts";
import { defaultParameterValues } from "../parameters.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import { dropLayerReferences } from "./layer.remove.ts";
import { notLayerOf } from "./kind-problems.ts";

/**
 * Gives a Visual Layer another Visual of the Catalog. Parameter Values and
 * bindings start over from the new Visual's defaults, and the Links and
 * Macro actions on the old Visual's Parameters and Cues go with them;
 * Targets and opacity stay. The Blend Mode follows the new Visual's own
 * only while it is still the one the old Visual started with. A Geometry
 * Visual gets a Frame fitted to the Targets unless the Layer has one; any
 * other Visual drops it.
 */
export const layerVisualSet = defineCommand({
  name: "layer.visual.set",
  kind: "authoring",
  description:
    "Choose the Visual a Visual Layer runs; its Parameters and bindings reset.",
  payload: z
    .object({ layerId: z.string().min(1), visual: z.string().min(1) })
    .strict(),
  label: () => "Change Visual",
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (layer?.kind !== "visual")
      return rejected(notLayerOf(document, payload.layerId, "visual"));
    const definition = visualDefinition(payload.visual);
    if (definition === undefined)
      return rejected(`“${payload.visual}” is not a Visual of the Catalog.`);
    if (layer.visual === definition.id) return accepted([]);
    const patches: Patch[] = dropLayerReferences(document, [
      `layer/${layer.id}/param/`,
      `layer/${layer.id}/cue/`,
    ]);
    const warnings = removalWarnings(document, patches, layer.name);
    const before = visualDefinition(layer.visual)?.blendMode ?? "normal";
    const after = definition.blendMode ?? "normal";
    if (layer.blendMode === before && after !== before)
      patches.push({
        op: "set",
        path: ["layers", layer.id, "blendMode"],
        value: after,
      });
    patches.push(
      { op: "set", path: ["layers", layer.id, "visual"], value: definition.id },
      {
        op: "set",
        path: ["layers", layer.id, "parameters"],
        value: { ...defaultParameterValues(definition.parameters) },
      },
      {
        op: "set",
        path: ["layers", layer.id, "bindings"],
        value: defaultBindings(definition),
      },
    );
    if (definition.geometry === undefined) {
      if (layer.frame !== undefined)
        patches.push({ op: "remove", path: ["layers", layer.id, "frame"] });
    } else if (layer.frame === undefined)
      patches.push({
        op: "set",
        path: ["layers", layer.id, "frame"],
        value: frameFittingTargets(document, layer),
      });
    return accepted(patches, undefined, warnings);
  },
});
