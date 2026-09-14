import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { treeMove } from "../document/tree.ts";

/** Places a Fixture Set after a sibling (or first) at the root or in a Group; a Group carries its contents. */
export const setMove = defineCommand({
  name: "set.move",
  kind: "authoring",
  description: "Move a Fixture Set within or across Groups.",
  payload: z
    .object({
      setId: z.string().min(1),
      parentId: z.string().min(1).nullable(),
      /** Sibling to land after in the destination; null for the top. */
      after: z.string().min(1).nullable(),
    })
    .strict(),
  label: () => "Move Fixture Set",
  coalesceKey: ({ setId }) => `set.move:${setId}`,
  apply({ document, payload }) {
    const set = document.fixtureSets[payload.setId];
    if (set === undefined)
      return rejected(`Fixture Set “${payload.setId}” does not exist.`);
    const patches = treeMove(
      { name: "fixtureSets", table: document.fixtureSets, noun: "Fixture Set" },
      set,
      payload.parentId,
      payload.after,
    );
    return "error" in patches ? rejected(patches.error) : accepted(patches);
  },
});
