import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { updateMode } from "../rig/edits/modes.ts";
import { ShapeSchema } from "../rig/fixture-type.ts";
import { editType, modeRef } from "./type-edit.ts";

/** Renames a Mode (its key stays) or changes its notes or its Shape Template. */
export const typeModeUpdate = defineCommand({
  name: "type.mode.update",
  kind: "authoring",
  description:
    "Change a Mode's name, notes or Shape Template; empty notes are removed.",
  payload: z
    .object({
      ...modeRef,
      name: z.string().trim().min(1).max(120).optional(),
      notes: z.string().optional(),
      shape: ShapeSchema.optional(),
    })
    .strict(),
  label: () => "Change Mode",
  coalesceKey: ({ typeKey, modeKey }) =>
    `type.mode.update:${typeKey}:${modeKey}`,
  apply({ document, payload }) {
    return editType(document, payload.typeKey, (type) =>
      updateMode(type, payload.modeKey, {
        name: payload.name,
        notes: payload.notes,
        shape: payload.shape,
      }),
    );
  },
});
