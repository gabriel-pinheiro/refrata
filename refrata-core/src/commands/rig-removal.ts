import type { Document } from "../document/document.ts";
import { dropMembers } from "../document/fixture-sets.ts";
import { dropTargets, lookLayers } from "../document/layers.ts";
import type { Patch } from "../document/patch.ts";
import { dropLayerReferences } from "./layer.remove.ts";

/**
 * What the Rig losing Elements takes out of the composition: the members of
 * every Set, the Targets of every Look Layer with their rows, and the Links
 * and Macro actions on those rows. `gone` says which Element refs no longer
 * exist, whether the Fixture went or its Mode changed.
 */
export function dropElementReferences(
  document: Document,
  gone: (ref: string) => boolean,
): { readonly patches: Patch[]; readonly warnings: string[] } {
  const members = dropMembers(document, gone);
  const targets = dropTargets(document, gone);
  const prefixes = lookLayers(document.layers).flatMap((layer) =>
    layer.targets
      .filter((target) => gone(target.ref))
      .map((target) => `layer/${layer.id}/row/${target.ref}/`),
  );
  const patches: Patch[] = [
    ...dropLayerReferences(document, prefixes),
    ...members.patches,
    ...targets.patches,
  ];
  const warnings: string[] = [];
  if (members.dropped > 0)
    warnings.push(
      `Removed ${members.dropped} Fixture Set ${members.dropped === 1 ? "member" : "members"}`,
    );
  const targetCount = [...targets.dropped.values()].reduce(
    (total, refs) => total + refs.length,
    0,
  );
  if (targetCount > 0)
    warnings.push(
      `Removed ${targetCount} Layer ${targetCount === 1 ? "Target" : "Targets"}`,
    );
  return { patches, warnings };
}
