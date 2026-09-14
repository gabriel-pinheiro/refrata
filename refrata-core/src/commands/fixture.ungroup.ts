import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { treeUngroup } from "../document/tree.ts";

/** Dissolves a Fixture Group: its contents take its place, in their order. */
export const fixtureUngroup = defineCommand({
  name: "fixture.ungroup",
  kind: "authoring",
  description: "Replace a Fixture Group by its contents.",
  payload: z.object({ fixtureId: z.string().min(1) }).strict(),
  label: () => "Ungroup",
  apply({ document, payload }) {
    const group = document.fixtures[payload.fixtureId];
    if (group === undefined)
      return rejected(`Fixture “${payload.fixtureId}” does not exist.`);
    const patches = treeUngroup(
      { name: "fixtures", table: document.fixtures, noun: "Fixture" },
      group,
    );
    return "error" in patches ? rejected(patches.error) : accepted(patches);
  },
});
