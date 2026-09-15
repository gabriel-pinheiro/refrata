import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { sameFixtureType } from "../document/fixture-types.ts";
import { fixturesOfType, patchProblem } from "../document/fixtures.ts";
import { applyPatches, type Patch } from "../document/patch.ts";
import { removalWarnings } from "../document/removal.ts";
import { elementsOf, parseElementRef } from "../rig/elements.ts";
import { FixtureTypeSchema, footprintOf } from "../rig/fixture-type.ts";
import { dropElementReferences } from "./rig-removal.ts";

/**
 * Replaces the Installation's copies of Fixture Types with newer files, as
 * one undo step whether it is one type or all of them. Refused when a
 * Fixture's Mode is gone from its new type or its new Footprint would
 * overlap a neighbour or run past the Universe: moving or repatching is the
 * person's call, not the reload's. Element keys a new Mode no longer has
 * take their Set memberships, Layer Targets, Links and Macro actions with
 * them, with the warnings a Mode change gives; everything on a key that
 * survives stays. A type identical to its copy changes nothing.
 */
export const fixtureReload = defineCommand({
  name: "fixture.reload",
  kind: "authoring",
  description:
    "Reload Fixture Types the Installation holds from newer definitions, such as the library's.",
  payload: z.object({ types: z.array(FixtureTypeSchema).min(1) }).strict(),
  label: ({ types }) =>
    types.length === 1
      ? `Reload ${types[0]?.model ?? "Fixture Type"}`
      : `Reload ${String(types.length)} Fixture Types`,
  apply({ document, payload }) {
    const changed = [];
    for (const type of payload.types) {
      const stored = document.fixtureTypes[type.key];
      if (stored === undefined)
        return rejected(
          `The Installation holds no Fixture Type “${type.key}”; add a Fixture of it instead.`,
        );
      if (!sameFixtureType(stored.type, type)) changed.push(type);
    }
    if (changed.length === 0) return accepted([]);

    const typePatches: Patch[] = changed.map((type) => ({
      op: "set",
      path: ["fixtureTypes", type.key],
      value: { id: type.key, type },
    }));
    const candidate = applyPatches(document, typePatches);
    // Element keys each reloaded Fixture keeps, by Fixture id.
    const keptKeys = new Map<string, ReadonlySet<string>>();
    for (const type of changed)
      for (const fixture of fixturesOfType(document.fixtures, type.key)) {
        const mode = type.modes[fixture.modeKey];
        if (mode === undefined)
          return rejected(
            `${fixture.name} uses Mode “${fixture.modeKey}”, which the new ${type.model} no longer has. Change its Mode first.`,
          );
        if (fixture.patch !== null) {
          const problem = patchProblem(
            candidate,
            fixture.patch.universeId,
            fixture.patch.address,
            footprintOf(mode),
            fixture.id,
          );
          if (problem !== undefined)
            return rejected(`Cannot reload ${fixture.name}: ${problem}`);
        }
        keptKeys.set(
          fixture.id,
          new Set(elementsOf(mode).map((element) => element.key)),
        );
      }

    const gone = (ref: string): boolean => {
      const parsed = parseElementRef(ref);
      const kept =
        parsed === undefined ? undefined : keptKeys.get(parsed.fixtureId);
      return (
        kept !== undefined && parsed !== undefined && !kept.has(parsed.key)
      );
    };
    const references = dropElementReferences(document, gone);
    const name =
      changed.length === 1 ? (changed[0]?.model ?? "") : "the reload";
    const warnings = removalWarnings(
      document,
      references.patches,
      name,
      references.warnings,
    );
    const patches: Patch[] = [...references.patches, ...typePatches];
    for (const ref of Object.keys(document.operational.highlight))
      if (gone(ref))
        patches.push({ op: "remove", path: ["operational", "highlight", ref] });
    return accepted(patches, undefined, warnings);
  },
});
