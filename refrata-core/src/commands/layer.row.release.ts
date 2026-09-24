import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { rowAddress } from "../composition/contributions.ts";
import { hasRowRef, rowPath, storedRow } from "../document/look-rows.ts";
import { dropActions } from "../document/macros.ts";
import type { Patch } from "../document/patch.ts";
import { removalWarnings } from "../document/removal.ts";
import { ATTRIBUTES, isAttributeKey } from "../rig/attributes.ts";
import { notLayerOf, notTargetOf } from "./kind-problems.ts";

/**
 * Releasing a row removes it, so what is below shows through (an "All
 * Targets" row when a Target's own row goes), and drops any Link or Macro
 * action on it.
 */
export const layerRowRelease = defineCommand({
  name: "layer.row.release",
  kind: "authoring",
  description:
    "Release a Look Layer row: the Attribute on those Targets, or on All Targets, says nothing again.",
  payload: z
    .object({
      layerId: z.string().min(1),
      targets: z.array(z.string().min(1)).min(1),
      attribute: z.string().min(1),
    })
    .strict(),
  label: ({ attribute }) =>
    `Release ${isAttributeKey(attribute) ? ATTRIBUTES[attribute].label : attribute}`,
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (layer?.kind !== "look")
      return rejected(notLayerOf(document, payload.layerId, "look"));
    const addresses = new Set<string>();
    const patches: Patch[] = [];
    for (const ref of new Set(payload.targets)) {
      if (!hasRowRef(layer, ref))
        return rejected(notTargetOf(document, ref, layer.name));
      addresses.add(rowAddress(layer.id, ref, payload.attribute));
      if (storedRow(layer, ref, payload.attribute) !== undefined)
        patches.push({
          op: "remove",
          path: rowPath(layer.id, ref, payload.attribute),
        });
    }
    for (const link of Object.values(document.links))
      if (addresses.has(link.address))
        patches.push({ op: "remove", path: ["links", link.id] });
    patches.push(
      ...dropActions(document, (action) => !addresses.has(action.address)),
    );
    const warnings = removalWarnings(document, patches, layer.name);
    return accepted(patches, undefined, warnings);
  },
});
