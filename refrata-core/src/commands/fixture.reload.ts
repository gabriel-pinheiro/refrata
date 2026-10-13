import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import {
  libraryOrigin,
  sameFixtureType,
  storedFixtureType,
} from "../document/fixture-types.ts";
import type { Patch } from "../document/patch.ts";
import { FixtureTypeSchema } from "../rig/fixture-type.ts";
import { typeChangeEffects } from "./type-change.ts";

/**
 * Takes the library's definition of Fixture Types the Installation holds,
 * as one undo step whether it is one type or several, under the rules a
 * type Fixtures use changes by (`typeChangeEffects`). After it each type
 * is from the library and stands as matching it. A type identical to the
 * one held changes nothing but what it remembers of the library.
 */
export const fixtureReload = defineCommand({
  name: "fixture.reload",
  kind: "authoring",
  description:
    "Replace Fixture Types the Installation holds with the definitions given, the library's; each then stands as matching the library.",
  payload: z.object({ types: z.array(FixtureTypeSchema).min(1) }).strict(),
  label: ({ types }) =>
    types.length === 1
      ? `Reload ${types[0]?.model ?? "Fixture Type"}`
      : `Reload ${String(types.length)} Fixture Types`,
  apply({ document, payload }) {
    const changed = [];
    const typePatches: Patch[] = [];
    for (const type of payload.types) {
      const stored = document.fixtureTypes[type.key];
      if (stored === undefined)
        return rejected(
          `The Installation holds no Fixture Type “${type.key}”; add a Fixture of it instead.`,
        );
      const origin = libraryOrigin(type);
      if (!sameFixtureType(stored.type, type)) {
        changed.push(type);
        typePatches.push({
          op: "set",
          path: ["fixtureTypes", type.key],
          value: storedFixtureType(type, origin),
        });
      } else if (
        stored.origin?.from !== "library" ||
        stored.origin.digest !== origin.digest
      )
        typePatches.push({
          op: "set",
          path: ["fixtureTypes", type.key, "origin"],
          value: origin,
        });
    }
    if (typePatches.length === 0) return accepted([]);
    const effects = typeChangeEffects(document, changed, "reload");
    if ("error" in effects) return rejected(effects.error);
    return accepted(
      [...effects.before, ...typePatches, ...effects.after],
      undefined,
      effects.warnings,
    );
  },
});
