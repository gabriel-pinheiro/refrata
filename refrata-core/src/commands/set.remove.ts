import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { setRef } from "../document/composition.ts";
import { descendantSets } from "../document/fixture-sets.ts";
import { dropTargets, lookLayers } from "../document/layers.ts";
import type { Patch } from "../document/patch.ts";
import { removalWarnings } from "../document/removal.ts";
import { dropLayerReferences } from "./layer.remove.ts";

/** Removing a Set takes it out of every Layer that Targets it, with the rows on it; a Group goes with its contents. */
export const setRemove = defineCommand({
  name: "set.remove",
  kind: "authoring",
  description:
    "Remove a Fixture Set or a Group with its contents; Layers targeting it drop the Target.",
  payload: z.object({ setId: z.string().min(1) }).strict(),
  label: () => "Remove Fixture Set",
  apply({ document, payload }) {
    const set = document.fixtureSets[payload.setId];
    if (set === undefined)
      return rejected(`Fixture Set “${payload.setId}” does not exist.`);
    const leaving = new Set<string>([
      set.id,
      ...descendantSets(document.fixtureSets, set.id).map((row) => row.id),
    ]);
    const refs = new Set([...leaving].map(setRef));
    const patches: Patch[] = dropLayerReferences(
      document,
      lookLayers(document.layers).flatMap((layer) =>
        [...refs].map((ref) => `layer/${layer.id}/row/${ref}/`),
      ),
    );
    const targets = dropTargets(document, (ref) => refs.has(ref));
    patches.push(...targets.patches);
    const layers = targets.dropped.size;
    const warnings = removalWarnings(
      document,
      patches,
      set.name,
      layers === 0
        ? []
        : [`Removed it from ${layers} ${layers === 1 ? "Layer" : "Layers"}`],
    );
    for (const id of leaving)
      patches.push({ op: "remove", path: ["fixtureSets", id] });
    return accepted(patches, undefined, warnings);
  },
});
