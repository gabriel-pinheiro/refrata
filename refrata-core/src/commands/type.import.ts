import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { diffPatches } from "../document/diff.ts";
import {
  freeTypeKey,
  libraryOrigin,
  storedFixtureType,
} from "../document/fixture-types.ts";
import { FixtureTypeSchema } from "../rig/fixture-type.ts";
import { typeChangeEffects } from "./type-change.ts";

/**
 * Brings a Fixture Type into the Installation from Refrata's library or
 * from a `.refrata-fixture` file, remembering which. When the Installation
 * already holds the key the caller says what to do: `replace` the held
 * type, under the rules a type Fixtures use changes by, or bring this one
 * in as a `copy` under a new key.
 */
export const typeImport = defineCommand({
  name: "type.import",
  kind: "authoring",
  description:
    "Import a Fixture Type from the library or a file. When its key is already held, say onHeld: replace or copy.",
  payload: z
    .object({
      fixtureType: FixtureTypeSchema,
      origin: z.discriminatedUnion("from", [
        z.object({ from: z.literal("library") }).strict(),
        z
          .object({ from: z.literal("file"), file: z.string().trim().min(1) })
          .strict(),
      ]),
      onHeld: z.enum(["replace", "copy"]).optional(),
    })
    .strict(),
  label: ({ fixtureType }) => `Import ${fixtureType.model}`,
  apply({ document, payload }) {
    const type = payload.fixtureType;
    const origin =
      payload.origin.from === "library" ? libraryOrigin(type) : payload.origin;
    const held = document.fixtureTypes[type.key];
    if (held === undefined)
      return accepted([
        {
          op: "set",
          path: ["fixtureTypes", type.key],
          value: storedFixtureType(type, origin),
        },
      ]);
    if (payload.onHeld === undefined)
      return rejected(
        `The Installation already holds “${type.key}”. Say whether to replace it or to bring this one in as a copy under a new key.`,
      );
    if (payload.onHeld === "copy") {
      const key = freeTypeKey(document, type.key);
      return accepted([
        {
          op: "set",
          path: ["fixtureTypes", key],
          value: storedFixtureType({ ...type, key }, origin),
        },
      ]);
    }
    const effects = typeChangeEffects(document, [type], "edit");
    if ("error" in effects) return rejected(effects.error);
    return accepted(
      [
        ...effects.before,
        ...diffPatches(held, storedFixtureType(type, origin), [
          "fixtureTypes",
          type.key,
        ]),
        ...effects.after,
      ],
      undefined,
      effects.warnings,
    );
  },
});
