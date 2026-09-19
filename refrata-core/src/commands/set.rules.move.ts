import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { ruleSetOf } from "./set-rules.ts";

/** Moves one Rule to another place; members come out Rule by Rule, so this reorders the Set. */
export const setRulesMove = defineCommand({
  name: "set.rules.move",
  kind: "authoring",
  description: "Move one Rule of a Fixture Set from one index to another.",
  payload: z
    .object({
      setId: z.string().min(1),
      index: z.number().int().min(0),
      to: z.number().int().min(0),
    })
    .strict(),
  label: () => "Move Rule",
  apply({ document, payload }) {
    const set = ruleSetOf(document, payload.setId);
    if ("error" in set) return rejected(set.error);
    const rule = set.rules[payload.index];
    if (rule === undefined)
      return rejected(`${set.name} has no Rule ${payload.index + 1}.`);
    const to = Math.min(payload.to, set.rules.length - 1);
    if (to === payload.index) return accepted([]);
    const rest = set.rules.filter((_, index) => index !== payload.index);
    return accepted([
      {
        op: "set",
        path: ["fixtureSets", set.id, "rules"],
        value: [...rest.slice(0, to), rule, ...rest.slice(to)],
      },
    ]);
  },
});
