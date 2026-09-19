import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { setMembers } from "../document/fixture-sets.ts";
import { ruleSetOf } from "./set-rules.ts";

/**
 * Turns a Set by rule into a Set by list holding the members it has now,
 * in their order. One way: Fixtures tagged later no longer join.
 */
export const setConvert = defineCommand({
  name: "set.convert",
  kind: "authoring",
  description:
    "Convert a Fixture Set by rule to a list of its current members; its Rules go.",
  payload: z.object({ setId: z.string().min(1) }).strict(),
  label: () => "Convert Set to List",
  apply({ document, payload }) {
    const set = ruleSetOf(document, payload.setId);
    if ("error" in set) return rejected(set.error);
    return accepted([
      {
        op: "set",
        path: ["fixtureSets", set.id, "members"],
        value: [...setMembers(document, set)],
      },
      { op: "remove", path: ["fixtureSets", set.id, "rules"] },
    ]);
  },
});
