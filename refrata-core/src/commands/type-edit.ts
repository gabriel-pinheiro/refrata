import { z } from "zod";

import { accepted, rejected, type CommandOutcome } from "../command/command.ts";
import { diffPatches } from "../document/diff.ts";
import type { Document } from "../document/document.ts";
import type { Edited } from "../rig/edits/edit.ts";
import {
  FixtureTypeSchema,
  type FixtureType,
  type Mode,
} from "../rig/fixture-type.ts";
import { typeChangeEffects } from "./type-change.ts";

/**
 * What every `type.*` command shares. An edit computes the next type with
 * a pure function from `rig/edits/`; this refuses one that would leave the
 * type failing its schema, applies the rules for a type Fixtures use, and
 * returns a patch per property that changed, never the whole type.
 */

/** The payload fields naming a Fixture Type the Installation holds, and one of its Modes. */
export const typeRef = { typeKey: z.string().min(1) };
export const modeRef = { ...typeRef, modeKey: z.string().min(1) };
/** The payload fields naming one Parameter of one Element of a Mode. */
export const parameterRef = {
  ...modeRef,
  element: z.string().min(1),
  attribute: z.string().min(1),
};

/** Two bytes; whether they run low to high is the edit's to say, in words. */
export const BytesSchema = z.tuple([
  z.number().int().min(0).max(255),
  z.number().int().min(0).max(255),
]);

export function notHeld(typeKey: string): CommandOutcome {
  return rejected(`The Installation holds no Fixture Type “${typeKey}”.`);
}

/** Runs `edit` on a held type as a command's outcome. */
export function editType(
  document: Document,
  typeKey: string,
  edit: (type: FixtureType) => Edited<FixtureType>,
): CommandOutcome {
  const stored = document.fixtureTypes[typeKey];
  if (stored === undefined) return notHeld(typeKey);
  const next = edit(stored.type);
  if ("error" in next) return rejected(next.error);
  if (next === stored.type) return accepted([]);
  const parsed = FixtureTypeSchema.safeParse(next);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const what =
      issue?.code === "custom"
        ? issue.message
        : `${issue?.path.join(" ") ?? ""} ${issue?.message ?? ""}`.trim();
    return rejected(`That would break ${stored.type.model}: ${what}.`);
  }
  const effects = typeChangeEffects(document, [next], "edit");
  if ("error" in effects) return rejected(effects.error);
  return accepted(
    [
      ...effects.before,
      ...diffPatches(stored.type, next, ["fixtureTypes", typeKey, "type"]),
      ...effects.after,
    ],
    undefined,
    effects.warnings,
  );
}

/** Runs `edit` on one Mode of a held type as a command's outcome. */
export function editMode(
  document: Document,
  ref: { readonly typeKey: string; readonly modeKey: string },
  edit: (mode: Mode, type: FixtureType) => Edited<Mode>,
): CommandOutcome {
  return editType(document, ref.typeKey, (type) => {
    const mode = type.modes[ref.modeKey];
    if (mode === undefined)
      return { error: `${type.model} has no Mode “${ref.modeKey}”.` };
    const next = edit(mode, type);
    if ("error" in next) return next;
    return next === mode
      ? type
      : { ...type, modes: { ...type.modes, [ref.modeKey]: next } };
  });
}
