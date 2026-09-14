import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { Patch } from "../document/patch.ts";
import { removalWarnings } from "../document/removal.ts";
import { dropLayerReferences } from "./layer.remove.ts";

/** Removing a Target drops its rows, and with them every Link and Macro action on them. */
export const layerTargetsRemove = defineCommand({
  name: "layer.targets.remove",
  kind: "authoring",
  description: "Remove Targets from a Look Layer, with their rows.",
  payload: z
    .object({
      layerId: z.string().min(1),
      targets: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  label: ({ targets }) =>
    targets.length === 1 ? "Remove Target" : `Remove ${targets.length} Targets`,
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (layer?.kind !== "look")
      return rejected(`“${payload.layerId}” is not a Look Layer.`);
    const going = new Set(payload.targets);
    for (const ref of going)
      if (!layer.targets.some((target) => target.ref === ref))
        return rejected(`“${ref}” is not a Target of the Layer.`);
    const patches: Patch[] = dropLayerReferences(
      document,
      [...going].map((ref) => `layer/${layer.id}/row/${ref}/`),
    );
    const warnings = removalWarnings(document, patches, layer.name);
    patches.push({
      op: "set",
      path: ["layers", layer.id, "targets"],
      value: layer.targets.filter((target) => !going.has(target.ref)),
    });
    for (const ref of going)
      if (ref in layer.rows)
        patches.push({ op: "remove", path: ["layers", layer.id, "rows", ref] });
    return accepted(patches, undefined, warnings);
  },
});
