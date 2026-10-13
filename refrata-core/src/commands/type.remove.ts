import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { typeRemovalProblem } from "../document/fixture-types.ts";
import { notHeld, typeRef } from "./type-edit.ts";

/** Removes a Fixture Type from the Installation, refused while a Fixture uses it. */
export const typeRemove = defineCommand({
  name: "type.remove",
  kind: "authoring",
  description:
    "Remove a Fixture Type from the Installation; refused while a Fixture uses it.",
  payload: z.object({ ...typeRef }).strict(),
  label: () => "Remove Fixture Type",
  apply({ document, payload }) {
    const stored = document.fixtureTypes[payload.typeKey];
    if (stored === undefined) return notHeld(payload.typeKey);
    const problem = typeRemovalProblem(
      document.fixtures,
      stored.type.model,
      payload.typeKey,
    );
    if (problem !== undefined) return rejected(problem);
    return accepted([
      { op: "remove", path: ["fixtureTypes", payload.typeKey] },
    ]);
  },
});
