import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { isRuleSet } from "../document/fixture-sets.ts";
import { notFixtureSet, notMemberOf } from "./kind-problems.ts";

/** Places a member after another (or first): the order effects will spread along. */
export const setMembersMove = defineCommand({
  name: "set.members.move",
  kind: "authoring",
  description: "Move an Element within a Fixture Set's order.",
  payload: z
    .object({
      setId: z.string().min(1),
      ref: z.string().min(1),
      /** Member to land after; null for first. */
      after: z.string().min(1).nullable(),
    })
    .strict(),
  label: () => "Move Member",
  coalesceKey: ({ setId, ref }) => `set.members.move:${setId}:${ref}`,
  apply({ document, payload }) {
    const set = document.fixtureSets[payload.setId];
    if (set?.kind !== "set")
      return rejected(notFixtureSet(document, payload.setId));
    if (isRuleSet(set))
      return rejected(
        `${set.name} is a Set by rule; its members come from its Rules.`,
      );
    if (!set.members.includes(payload.ref))
      return rejected(notMemberOf(document, payload.ref, set.name));
    if (payload.after === payload.ref)
      return rejected("A member cannot be placed after itself.");
    const rest = set.members.filter((ref) => ref !== payload.ref);
    const at = payload.after === null ? 0 : rest.indexOf(payload.after) + 1;
    if (at === 0 && payload.after !== null)
      return rejected(notMemberOf(document, payload.after, set.name));
    const members = [...rest.slice(0, at), payload.ref, ...rest.slice(at)];
    if (members.every((ref, index) => ref === set.members[index]))
      return accepted([]);
    return accepted([
      { op: "set", path: ["fixtureSets", set.id, "members"], value: members },
    ]);
  },
});
