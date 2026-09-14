import type { Document, Table } from "./document.ts";
import {
  FIXTURE_SET_LABELS,
  type FixtureSet,
  type MemberSet,
} from "./composition.ts";
import type { Patch } from "./patch.ts";
import { childrenOf, descendantsOf, flattenTree } from "./tree.ts";

export { FIXTURE_SET_LABELS };

/** The rows directly under the root (`parentId` null) or a Group, in order. */
export const childSets = (
  sets: Table<FixtureSet>,
  parentId: string | null,
): readonly FixtureSet[] => childrenOf(sets, parentId);

/** Every row in navigator order: depth first from the root. */
export const flattenSets = (sets: Table<FixtureSet>): readonly FixtureSet[] =>
  flattenTree(sets);

/** Every row below `setId`, depth first; empty unless it is a Group. */
export const descendantSets = (
  sets: Table<FixtureSet>,
  setId: string,
): readonly FixtureSet[] => descendantsOf(sets, setId);

/** The Sets (not Groups) in navigator order. */
export function allSets(sets: Table<FixtureSet>): readonly MemberSet[] {
  return flattenTree(sets).filter(
    (row): row is MemberSet => row.kind === "set",
  );
}

/**
 * Patches dropping, from every Set, the members `drop` names: what the
 * removal of a Fixture or an Element key takes with it. Returns how many
 * members went, for the removal warning.
 */
export function dropMembers(
  document: Pick<Document, "fixtureSets">,
  drop: (ref: string) => boolean,
): { readonly patches: Patch[]; readonly dropped: number } {
  const patches: Patch[] = [];
  let dropped = 0;
  for (const set of allSets(document.fixtureSets)) {
    const remaining = set.members.filter((ref) => !drop(ref));
    if (remaining.length === set.members.length) continue;
    dropped += set.members.length - remaining.length;
    patches.push({
      op: "set",
      path: ["fixtureSets", set.id, "members"],
      value: remaining,
    });
  }
  return { patches, dropped };
}
