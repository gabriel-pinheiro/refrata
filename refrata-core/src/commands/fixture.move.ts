import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { treeMove } from "../document/tree.ts";

/** Places a Fixture after a sibling (or first) at the root or in a Group; nothing can be dropped into a Fixture. */
export const fixtureMove = defineCommand({
  name: "fixture.move",
  kind: "authoring",
  description: "Move a Fixture within or across Groups in the navigator.",
  payload: z
    .object({
      fixtureId: z.string().min(1),
      parentId: z.string().min(1).nullable(),
      /** Sibling to land after in the destination; null for the top. */
      after: z.string().min(1).nullable(),
    })
    .strict(),
  label: () => "Move Fixture",
  coalesceKey: ({ fixtureId }) => `fixture.move:${fixtureId}`,
  apply({ document, payload }) {
    const fixture = document.fixtures[payload.fixtureId];
    if (fixture === undefined)
      return rejected(`Fixture “${payload.fixtureId}” does not exist.`);
    const patches = treeMove(
      { name: "fixtures", table: document.fixtures, noun: "Fixture" },
      fixture,
      payload.parentId,
      payload.after,
    );
    return "error" in patches ? rejected(patches.error) : accepted(patches);
  },
});
