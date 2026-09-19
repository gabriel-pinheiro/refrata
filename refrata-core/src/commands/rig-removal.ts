import type { Document } from "../document/document.ts";
import { dropMembers } from "../document/fixture-sets.ts";
import { allFixtures } from "../document/fixtures.ts";
import { dropTargets, lookLayers } from "../document/layers.ts";
import { fixtureRootRef } from "../document/targets.ts";
import type { Patch } from "../document/patch.ts";
import { elementRef } from "../rig/elements.ts";
import { dropLayerReferences } from "./layer.remove.ts";

/**
 * What the Rig losing Elements takes out of the composition: the members of
 * every Set, the Targets of every Look Layer with their rows, the Links and
 * Macro actions on those rows, and the Tags a person put on those Elements. `gone` says which Element refs no longer
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
  const tags = dropElementTags(document, gone);
  const patches: Patch[] = [
    ...dropLayerReferences(document, prefixes),
    ...members.patches,
    ...targets.patches,
    ...tags.patches,
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
  if (tags.dropped > 0)
    warnings.push(
      `Removed Tags from ${tags.dropped} ${tags.dropped === 1 ? "Element" : "Elements"}`,
    );
  return { patches, warnings };
}

/** Patches dropping the person's Tags of the non-root Elements `gone` names; a Fixture that goes takes its own along. */
function dropElementTags(
  document: Pick<Document, "fixtures">,
  gone: (ref: string) => boolean,
): { readonly patches: Patch[]; readonly dropped: number } {
  const patches: Patch[] = [];
  for (const fixture of allFixtures(document.fixtures)) {
    if (gone(fixtureRootRef(fixture.id))) continue;
    for (const key of Object.keys(fixture.elementTags))
      if (gone(elementRef(fixture.id, key)))
        patches.push({
          op: "remove",
          path: ["fixtures", fixture.id, "elementTags", key],
        });
  }
  return { patches, dropped: patches.length };
}
