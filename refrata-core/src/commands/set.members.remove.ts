import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { isRuleSet } from "../document/fixture-sets.ts";
import { notFixtureSet, notMemberOf } from "./kind-problems.ts";

export const setMembersRemove = defineCommand({
  name: "set.members.remove",
  kind: "authoring",
  description: "Remove Elements from a Fixture Set.",
  payload: z
    .object({
      setId: z.string().min(1),
      refs: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  label: ({ refs }) =>
    refs.length === 1 ? "Remove Member" : `Remove ${refs.length} Members`,
  apply({ document, payload }) {
    const set = document.fixtureSets[payload.setId];
    if (set?.kind !== "set")
      return rejected(notFixtureSet(document, payload.setId));
    if (isRuleSet(set))
      return rejected(
        `${set.name} is a Set by rule; its members come from its Rules.`,
      );
    const going = new Set(payload.refs);
    for (const ref of going)
      if (!set.members.includes(ref))
        return rejected(notMemberOf(document, ref, set.name));
    return accepted([
      {
        op: "set",
        path: ["fixtureSets", set.id, "members"],
        value: set.members.filter((ref) => !going.has(ref)),
      },
    ]);
  },
});
