import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { storedFixtureType } from "../document/fixture-types.ts";
import { typeKeyFor } from "../rig/edits/modes.ts";
import { notHeld, typeRef } from "./type-edit.ts";

/** The model a duplicate of `model` starts with. */
export function duplicateModel(model: string): string {
  return `${model} copy`;
}

/** Copies a held Fixture Type under a new key, as a type made in this Installation. */
export const typeDuplicate = defineCommand({
  name: "type.duplicate",
  kind: "authoring",
  description:
    "Duplicate a Fixture Type the Installation holds under a new key; the model is the original's with “copy” unless told.",
  payload: z
    .object({
      ...typeRef,
      model: z.string().trim().min(1).max(120).optional(),
    })
    .strict(),
  label: () => "Duplicate Fixture Type",
  apply({ document, payload }) {
    const stored = document.fixtureTypes[payload.typeKey];
    if (stored === undefined) return notHeld(payload.typeKey);
    const model = payload.model ?? duplicateModel(stored.type.model);
    const key = typeKeyFor(
      Object.keys(document.fixtureTypes),
      stored.type.manufacturer,
      model,
    );
    if (key === undefined)
      return rejected("Give the model a name with a letter or a digit.");
    return accepted([
      {
        op: "set",
        path: ["fixtureTypes", key],
        value: storedFixtureType(
          { ...stored.type, key, model },
          { from: "installation" },
        ),
      },
    ]);
  },
});
