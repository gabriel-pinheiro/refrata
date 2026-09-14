import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { treeRename } from "../document/tree.ts";

export const fixtureRename = defineCommand({
  name: "fixture.rename",
  kind: "authoring",
  description: "Rename a Fixture or a Fixture Group.",
  payload: z
    .object({
      fixtureId: z.string().min(1),
      name: z.string().trim().min(1).max(120),
    })
    .strict(),
  label: () => "Rename Fixture",
  coalesceKey: ({ fixtureId }) => `fixture.rename:${fixtureId}`,
  apply({ document, payload }) {
    const fixture = document.fixtures[payload.fixtureId];
    if (fixture === undefined)
      return rejected(`Fixture “${payload.fixtureId}” does not exist.`);
    const patches = treeRename(
      { name: "fixtures", table: document.fixtures, noun: "Fixture" },
      fixture,
      payload.name,
    );
    return "error" in patches ? rejected(patches.error) : accepted(patches);
  },
});
