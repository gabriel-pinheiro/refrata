import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { RuleSchema } from "../document/composition.ts";
import { cleanRule, ruleLabel, ruleSetOf, sameRule } from "./set-rules.ts";

/** Replaces the Tags of one Rule, named by its place in the Set. */
export const setRulesUpdate = defineCommand({
  name: "set.rules.update",
  kind: "authoring",
  description: "Change the Tags of one Rule of a Fixture Set, by index.",
  payload: z
    .object({
      setId: z.string().min(1),
      index: z.number().int().min(0),
      tags: RuleSchema,
    })
    .strict(),
  label: () => "Change Rule",
  apply({ document, payload }) {
    const set = ruleSetOf(document, payload.setId);
    if ("error" in set) return rejected(set.error);
    const current = set.rules[payload.index];
    if (current === undefined)
      return rejected(`${set.name} has no Rule ${payload.index + 1}.`);
    const rule = cleanRule(payload.tags);
    if (current.join(" ") === rule.join(" ")) return accepted([]);
    if (
      set.rules.some(
        (other, index) => index !== payload.index && sameRule(other, rule),
      )
    )
      return rejected(`${set.name} already has the Rule ${ruleLabel(rule)}.`);
    return accepted([
      {
        op: "set",
        path: ["fixtureSets", set.id, "rules"],
        value: set.rules.map((other, index) =>
          index === payload.index ? rule : other,
        ),
      },
    ]);
  },
});
