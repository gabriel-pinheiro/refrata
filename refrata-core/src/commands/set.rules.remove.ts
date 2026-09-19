import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { ruleSetOf } from "./set-rules.ts";

/** Removes one Rule, named by its place in the Set; a Set with no Rules is empty. */
export const setRulesRemove = defineCommand({
  name: "set.rules.remove",
  kind: "authoring",
  description: "Remove one Rule of a Fixture Set, by index.",
  payload: z
    .object({ setId: z.string().min(1), index: z.number().int().min(0) })
    .strict(),
  label: () => "Remove Rule",
  apply({ document, payload }) {
    const set = ruleSetOf(document, payload.setId);
    if ("error" in set) return rejected(set.error);
    if (set.rules[payload.index] === undefined)
      return rejected(`${set.name} has no Rule ${payload.index + 1}.`);
    return accepted([
      {
        op: "set",
        path: ["fixtureSets", set.id, "rules"],
        value: set.rules.filter((_, index) => index !== payload.index),
      },
    ]);
  },
});
