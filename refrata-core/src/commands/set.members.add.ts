import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { isRuleSet } from "../document/fixture-sets.ts";
import { memberProblem } from "../document/targets.ts";
import { notFixtureSet, notMemberOf } from "./kind-problems.ts";

/** Appends Elements to a Set, or inserts them after one of its members; a member already there stays where it is. */
export const setMembersAdd = defineCommand({
  name: "set.members.add",
  kind: "authoring",
  description: "Add Elements (<fixtureId>/<key>) to a Fixture Set.",
  payload: z
    .object({
      setId: z.string().min(1),
      refs: z.array(z.string().min(1)).min(1),
      /** Member to insert after; null for first; absent to append. */
      after: z.string().min(1).nullable().optional(),
    })
    .strict(),
  label: ({ refs }) =>
    refs.length === 1 ? "Add Member" : `Add ${refs.length} Members`,
  apply({ document, payload }) {
    const set = document.fixtureSets[payload.setId];
    if (set?.kind !== "set")
      return rejected(notFixtureSet(document, payload.setId));
    if (isRuleSet(set))
      return rejected(
        `${set.name} is a Set by rule; its members come from its Rules.`,
      );
    const present = new Set(set.members);
    const added: string[] = [];
    for (const ref of new Set(payload.refs)) {
      if (present.has(ref)) continue;
      const problem = memberProblem(document, ref);
      if (problem !== undefined) return rejected(problem);
      added.push(ref);
    }
    if (added.length === 0) return accepted([]);
    const at =
      payload.after === undefined
        ? set.members.length
        : payload.after === null
          ? 0
          : set.members.indexOf(payload.after) + 1;
    if (at === 0 && payload.after !== null && payload.after !== undefined)
      return rejected(notMemberOf(document, payload.after, set.name));
    const members = [
      ...set.members.slice(0, at),
      ...added,
      ...set.members.slice(at),
    ];
    return accepted([
      { op: "set", path: ["fixtureSets", set.id, "members"], value: members },
    ]);
  },
});
