import type { Document, Table } from "./document.ts";
import {
  FIXTURE_SET_LABELS,
  type FixtureSet,
  type MemberSet,
} from "./composition.ts";
import { ancestorsOf, parseElementRef } from "../rig/elements.ts";
import { fixtureElements } from "./fixtures.ts";
import type { Patch } from "./patch.ts";
import { matchRule } from "./tags.ts";
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

/** Whether a Set is written by rule; otherwise it is a list. */
export function isRuleSet(
  set: MemberSet,
): set is MemberSet & { readonly rules: readonly (readonly string[])[] } {
  return set.rules !== undefined;
}

type RuleSource = Pick<Document, "fixtures" | "fixtureTypes">;

const derived = new WeakMap<
  MemberSet,
  { readonly source: RuleSource; readonly members: readonly string[] }
>();

/**
 * The ordered Element refs a Set stands for. A list Set's are stored. A rule
 * Set's are the union of its Rules, Rule by Rule with the first occurrence
 * kept, less every member that has an ancestor among the members. Derived
 * once per Set and Rig, since Resolve asks at the Output rate.
 */
export function setMembers(
  document: RuleSource,
  set: MemberSet,
): readonly string[] {
  if (!isRuleSet(set)) return set.members;
  const cached = derived.get(set);
  if (
    cached?.source.fixtures === document.fixtures &&
    cached.source.fixtureTypes === document.fixtureTypes
  )
    return cached.members;
  const union = [
    ...new Set(set.rules.flatMap((rule) => matchRule(document, rule))),
  ];
  const present = new Set(union);
  const members = union.filter((ref) => !hasAncestorIn(document, ref, present));
  derived.set(set, {
    source: {
      fixtures: document.fixtures,
      fixtureTypes: document.fixtureTypes,
    },
    members,
  });
  return members;
}

function hasAncestorIn(
  document: RuleSource,
  ref: string,
  present: ReadonlySet<string>,
): boolean {
  const parsed = parseElementRef(ref);
  if (parsed === undefined) return false;
  const fixture = document.fixtures[parsed.fixtureId];
  if (fixture?.kind !== "fixture") return false;
  return ancestorsOf(fixtureElements(document, fixture), parsed.key).some(
    (ancestor) =>
      ancestor.key !== parsed.key &&
      present.has(`${parsed.fixtureId}/${ancestor.key}`),
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
