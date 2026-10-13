import type { Document } from "../document/document.ts";
import { fixturesOfType, patchProblem } from "../document/fixtures.ts";
import type { Patch } from "../document/patch.ts";
import { removalWarnings } from "../document/removal.ts";
import { elementsOf, parseElementRef } from "../rig/elements.ts";
import { footprintOf, type FixtureType } from "../rig/fixture-type.ts";
import { dropElementReferences } from "./rig-removal.ts";

/**
 * What changing Fixture Types the Installation holds does to the Fixtures
 * that use them, whether a reload replaces a whole type or an edit changes
 * one property. Refused when a Fixture's Mode is gone or its Footprint
 * would grow into a neighbour or past the end of its Universe: changing
 * its Mode or repatching it is the person's call. Element keys a Mode no
 * longer has take their Set memberships, Layer Targets, Preset rows, Links
 * and Macro actions on those Fixtures with them, and held highlights and
 * running Actions on what went are dropped.
 */
export interface TypeChangeEffects {
  /** What goes before the type's own patches: the references dropped. */
  readonly before: Patch[];
  /** What goes after them: live state on what went. */
  readonly after: Patch[];
  readonly warnings: string[];
}

export function typeChangeEffects(
  document: Document,
  changed: readonly FixtureType[],
  /** `reload` words its refusals for a type taken whole; `edit` for one change. */
  how: "reload" | "edit",
): TypeChangeEffects | { readonly error: string } {
  const fixtureTypes = { ...document.fixtureTypes };
  for (const type of changed) {
    const stored = fixtureTypes[type.key];
    if (stored !== undefined) fixtureTypes[type.key] = { ...stored, type };
  }
  const candidate = { ...document, fixtureTypes };
  // Element and Action keys each Fixture of a changed type keeps, by Fixture id.
  const keptElements = new Map<string, ReadonlySet<string>>();
  const keptActions = new Map<string, ReadonlySet<string>>();
  for (const type of changed) {
    const old = document.fixtureTypes[type.key]?.type;
    for (const fixture of fixturesOfType(document.fixtures, type.key)) {
      const mode = type.modes[fixture.modeKey];
      const oldMode = old?.modes[fixture.modeKey];
      if (mode === undefined)
        return {
          error:
            how === "reload"
              ? `${fixture.name} uses Mode “${fixture.modeKey}”, which the new ${type.model} no longer has. Change its Mode first.`
              : `${fixture.name} is on Mode “${oldMode?.name ?? fixture.modeKey}”. Change its Mode first.`,
        };
      const grew =
        oldMode === undefined || footprintOf(mode) > footprintOf(oldMode);
      if (fixture.patch !== null && grew) {
        const problem = patchProblem(
          candidate,
          fixture.patch.universeId,
          fixture.patch.address,
          footprintOf(mode),
          fixture.id,
        );
        if (problem !== undefined)
          return {
            error:
              how === "reload"
                ? `Cannot reload ${fixture.name}: ${problem}`
                : `${fixture.name} has no room for it: ${problem} Repatch it first.`,
          };
      }
      keptElements.set(
        fixture.id,
        new Set(elementsOf(mode).map((element) => element.key)),
      );
      keptActions.set(fixture.id, new Set(Object.keys(mode.actions)));
    }
  }

  const goneFrom =
    (kept: ReadonlyMap<string, ReadonlySet<string>>) =>
    (ref: string): boolean => {
      const parsed = parseElementRef(ref);
      const keys =
        parsed === undefined ? undefined : kept.get(parsed.fixtureId);
      return (
        keys !== undefined && parsed !== undefined && !keys.has(parsed.key)
      );
    };
  const gone = goneFrom(keptElements);
  const references = dropElementReferences(document, gone);
  const name = changed.length === 1 ? (changed[0]?.model ?? "") : "the reload";
  const warnings = removalWarnings(
    document,
    references.patches,
    name,
    references.warnings,
  );
  const after: Patch[] = [];
  for (const ref of Object.keys(document.operational.highlight))
    if (gone(ref))
      after.push({ op: "remove", path: ["operational", "highlight", ref] });
  const stopped = goneFrom(keptActions);
  for (const ref of Object.keys(document.operational.actions))
    if (stopped(ref))
      after.push({ op: "remove", path: ["operational", "actions", ref] });
  return { before: references.patches, after, warnings };
}
