import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { releaseFixtureType } from "../document/fixture-types.ts";
import { descendantFixtures } from "../document/fixtures.ts";
import type { Patch } from "../document/patch.ts";

/** Removing a Fixture drops its held highlights and, when it was the last of its type, the type's copy; a Group goes with its contents. */
export const fixtureRemove = defineCommand({
  name: "fixture.remove",
  kind: "authoring",
  description:
    "Remove a Fixture or a Group with its contents; a Fixture Type nothing uses any more goes too.",
  payload: z.object({ fixtureId: z.string().min(1) }).strict(),
  label: () => "Remove Fixture",
  apply({ document, payload }) {
    const fixture = document.fixtures[payload.fixtureId];
    if (fixture === undefined)
      return rejected(`Fixture “${payload.fixtureId}” does not exist.`);
    const removed = [
      fixture,
      ...descendantFixtures(document.fixtures, fixture.id),
    ];
    const leaving = new Set<string>(removed.map((row) => row.id));
    const patches: Patch[] = [];
    for (const ref of Object.keys(document.operational.highlight)) {
      const fixtureId = ref.slice(0, ref.lastIndexOf("/"));
      if (leaving.has(fixtureId))
        patches.push({ op: "remove", path: ["operational", "highlight", ref] });
    }
    const typeKeys = new Set(
      removed.flatMap((row) => (row.kind === "fixture" ? [row.typeKey] : [])),
    );
    for (const typeKey of typeKeys)
      patches.push(...releaseFixtureType(document, typeKey, leaving));
    for (const id of leaving)
      patches.push({ op: "remove", path: ["fixtures", id] });
    return accepted(patches);
  },
});
