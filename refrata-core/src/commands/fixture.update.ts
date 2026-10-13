import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { ensureFixtureType } from "../document/fixture-types.ts";
import { patchProblem } from "../document/fixtures.ts";
import { applyPatches, type Patch } from "../document/patch.ts";
import { removalWarnings } from "../document/removal.ts";
import { elementsOf, parseElementRef } from "../rig/elements.ts";
import { FixtureTypeSchema, footprintOf } from "../rig/fixture-type.ts";
import { dropElementReferences } from "./rig-removal.ts";

/**
 * Changes a Fixture's type or Mode (refused when the new Footprint would
 * overlap a neighbour in its Universe; the old type stays in the
 * Installation). Every Set member, Layer Target and person's Tag whose
 * Element key the new Mode keeps survives; the rest are dropped with a
 * warning.
 */
export const fixtureUpdate = defineCommand({
  name: "fixture.update",
  kind: "authoring",
  description: "Change a Fixture's Fixture Type or Mode.",
  payload: z
    .object({
      fixtureId: z.string().min(1),
      typeKey: z.string().min(1).optional(),
      modeKey: z.string().min(1).optional(),
      /** The Fixture Type itself, when the Installation does not hold `typeKey` yet. */
      fixtureType: FixtureTypeSchema.optional(),
    })
    .strict(),
  label: () => "Change Fixture",
  apply({ document, payload }) {
    const fixture = document.fixtures[payload.fixtureId];
    if (fixture?.kind !== "fixture")
      return rejected(`Fixture “${payload.fixtureId}” does not exist.`);
    const patches: Patch[] = [];
    let warnings: string[] = [];
    const typeKey = payload.typeKey ?? fixture.typeKey;
    const modeKey = payload.modeKey ?? fixture.modeKey;
    if (typeKey !== fixture.typeKey || modeKey !== fixture.modeKey) {
      const typePatches = ensureFixtureType(
        document,
        typeKey,
        payload.fixtureType,
      );
      if ("error" in typePatches) return rejected(typePatches.error);
      const withType = applyPatches(document, typePatches);
      const mode = withType.fixtureTypes[typeKey]?.type.modes[modeKey];
      if (mode === undefined)
        return rejected(`Fixture Type “${typeKey}” has no Mode “${modeKey}”.`);
      if (fixture.patch !== null) {
        const problem = patchProblem(
          withType,
          fixture.patch.universeId,
          fixture.patch.address,
          footprintOf(mode),
          fixture.id,
        );
        if (problem !== undefined)
          return rejected(`Cannot change Mode: ${problem}`);
      }
      const kept = new Set(elementsOf(mode).map((element) => element.key));
      const references = dropElementReferences(document, (ref) => {
        const parsed = parseElementRef(ref);
        return parsed?.fixtureId === fixture.id && !kept.has(parsed.key);
      });
      patches.push(...references.patches);
      warnings = removalWarnings(
        document,
        references.patches,
        fixture.name,
        references.warnings,
      );
      patches.push(...typePatches);
      if (typeKey !== fixture.typeKey)
        patches.push({
          op: "set",
          path: ["fixtures", fixture.id, "typeKey"],
          value: typeKey,
        });
      if (modeKey !== fixture.modeKey)
        patches.push({
          op: "set",
          path: ["fixtures", fixture.id, "modeKey"],
          value: modeKey,
        });
      for (const ref of Object.keys(document.operational.highlight))
        if (ref.startsWith(`${fixture.id}/`))
          patches.push({
            op: "remove",
            path: ["operational", "highlight", ref],
          });
    }
    return accepted(patches, undefined, warnings);
  },
});
