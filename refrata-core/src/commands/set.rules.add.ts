import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { RuleSchema } from "../document/composition.ts";
import { cleanRule, ruleLabel, ruleSetOf, sameRule } from "./set-rules.ts";

/** Adds a Rule to a Set by rule, last or at `index`; the Set is the union of its Rules in their order. */
export const setRulesAdd = defineCommand({
  name: "set.rules.add",
  kind: "authoring",
  description:
    "Add a Rule (all of these Tags; none for every Fixture) to a Fixture Set by rule.",
  payload: z
    .object({
      setId: z.string().min(1),
      tags: RuleSchema,
      /** Where the Rule lands; absent to append. */
      index: z.number().int().min(0).optional(),
    })
    .strict(),
  label: () => "Add Rule",
  apply({ document, payload }) {
    const set = ruleSetOf(document, payload.setId);
    if ("error" in set) return rejected(set.error);
    const rule = cleanRule(payload.tags);
    if (set.rules.some((other) => sameRule(other, rule)))
      return rejected(`${set.name} already has the Rule ${ruleLabel(rule)}.`);
    const at = Math.min(payload.index ?? set.rules.length, set.rules.length);
    return accepted([
      {
        op: "set",
        path: ["fixtureSets", set.id, "rules"],
        value: [...set.rules.slice(0, at), rule, ...set.rules.slice(at)],
      },
    ]);
  },
});
