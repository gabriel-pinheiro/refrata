import type { MemberSet, Rule } from "../document/composition.ts";
import { isRuleSet } from "../document/fixture-sets.ts";
import type { Document } from "../document/document.ts";
import { notFixtureSet } from "./kind-problems.ts";

/** A Rule as stored: each Tag once, in the order given. */
export const cleanRule = (tags: readonly string[]): Rule => [...new Set(tags)];

/** Whether two Rules ask for the same Tags, whatever the order. */
export function sameRule(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag) => b.includes(tag));
}

/** "panel + odd", or "every Fixture" for the Rule with no Tags. */
export function ruleLabel(rule: readonly string[]): string {
  return rule.length === 0 ? "every Fixture" : rule.join(" + ");
}

/** The rule Set `setId` names, or why it is not one. */
export function ruleSetOf(
  document: Pick<Document, "fixtureSets">,
  setId: string,
):
  | (MemberSet & { readonly rules: readonly Rule[] })
  | { readonly error: string } {
  const set = document.fixtureSets[setId];
  if (set?.kind !== "set") return { error: notFixtureSet(document, setId) };
  if (!isRuleSet(set))
    return { error: `${set.name} is a Set by list; it has no Rules.` };
  return set;
}
