import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { addOption } from "../rig/edits/options.ts";
import { BytesSchema, editMode, parameterRef } from "./type-edit.ts";

/** Adds an option to an open choice. Its value comes from its label, made unique, and never changes: Look rows and Presets store it. */
export const typeOptionAdd = defineCommand({
  name: "type.option.add",
  kind: "authoring",
  description:
    "Add an option to an open choice Parameter; its value comes from its label and is fixed, its bytes start where the highest range ends unless told.",
  payload: z
    .object({
      ...parameterRef,
      label: z.string().trim().min(1).max(120),
      bytes: BytesSchema.optional(),
    })
    .strict(),
  label: () => "Add Option",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      addOption(mode, payload.element, payload.attribute, {
        label: payload.label,
        bytes: payload.bytes,
      }),
    );
  },
});
