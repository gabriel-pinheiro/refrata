import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { updateOption } from "../rig/edits/options.ts";
import { BytesSchema, editMode, parameterRef } from "./type-edit.ts";

/** Relabels an option (its value stays) or changes the bytes that select it. */
export const typeOptionUpdate = defineCommand({
  name: "type.option.update",
  kind: "authoring",
  description:
    "Change an option's label or bytes; its value does not follow a relabel.",
  payload: z
    .object({
      ...parameterRef,
      option: z.string().min(1),
      label: z.string().trim().min(1).max(120).optional(),
      bytes: BytesSchema.optional(),
    })
    .strict(),
  label: () => "Change Option",
  coalesceKey: ({ typeKey, modeKey, element, attribute, option }) =>
    `type.option.update:${typeKey}:${modeKey}:${element}:${attribute}:${option}`,
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      updateOption(mode, payload.element, payload.attribute, payload.option, {
        label: payload.label,
        bytes: payload.bytes,
      }),
    );
  },
});
