import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { treeUngroup } from "../document/tree.ts";

/** Dissolves a Fixture Set Group: its contents take its place, in their order. */
export const setUngroup = defineCommand({
  name: "set.ungroup",
  kind: "authoring",
  description: "Replace a Fixture Set Group by its contents.",
  payload: z.object({ setId: z.string().min(1) }).strict(),
  label: () => "Ungroup",
  apply({ document, payload }) {
    const group = document.fixtureSets[payload.setId];
    if (group === undefined)
      return rejected(`Fixture Set “${payload.setId}” does not exist.`);
    const patches = treeUngroup(
      { name: "fixtureSets", table: document.fixtureSets, noun: "Fixture Set" },
      group,
    );
    return "error" in patches ? rejected(patches.error) : accepted(patches);
  },
});
