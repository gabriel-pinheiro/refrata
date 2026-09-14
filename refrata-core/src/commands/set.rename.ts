import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { treeRename } from "../document/tree.ts";

export const setRename = defineCommand({
  name: "set.rename",
  kind: "authoring",
  description: "Rename a Fixture Set.",
  payload: z
    .object({
      setId: z.string().min(1),
      name: z.string().trim().min(1).max(120),
    })
    .strict(),
  label: () => "Rename Fixture Set",
  coalesceKey: ({ setId }) => `set.rename:${setId}`,
  apply({ document, payload }) {
    const set = document.fixtureSets[payload.setId];
    if (set === undefined)
      return rejected(`Fixture Set “${payload.setId}” does not exist.`);
    const patches = treeRename(
      { name: "fixtureSets", table: document.fixtureSets, noun: "Fixture Set" },
      set,
      payload.name,
    );
    return "error" in patches ? rejected(patches.error) : accepted(patches);
  },
});
