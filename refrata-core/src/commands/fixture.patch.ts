import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { fixtureFootprint, patchProblem } from "../document/fixtures.ts";
import { PatchSchema } from "../document/rig.ts";

/** Patches a Fixture at a Universe and start address, refusing overlap, or unpatches it with null. */
export const fixturePatch = defineCommand({
  name: "fixture.patch",
  kind: "authoring",
  description:
    "Patch a Fixture into a Universe at a start address (overlap is refused), or unpatch it with null.",
  payload: z
    .object({ fixtureId: z.string().min(1), patch: PatchSchema.nullable() })
    .strict(),
  label: ({ patch }) => (patch === null ? "Unpatch Fixture" : "Patch Fixture"),
  apply({ document, payload }) {
    const fixture = document.fixtures[payload.fixtureId];
    if (fixture?.kind !== "fixture")
      return rejected(`Fixture “${payload.fixtureId}” does not exist.`);
    if (payload.patch !== null) {
      const problem = patchProblem(
        document,
        payload.patch.universeId,
        payload.patch.address,
        fixtureFootprint(document, fixture),
        fixture.id,
      );
      if (problem !== undefined) return rejected(problem);
    }
    if (
      fixture.patch?.universeId === payload.patch?.universeId &&
      fixture.patch?.address === payload.patch?.address
    )
      return accepted([]);
    return accepted([
      {
        op: "set",
        path: ["fixtures", fixture.id, "patch"],
        value: payload.patch,
      },
    ]);
  },
});
