import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { updateSwatch } from "../rig/edits/swatches.ts";
import { SwatchColorSchema } from "./type.swatch.add.ts";
import { BytesSchema, editMode, parameterRef } from "./type-edit.ts";

/** Changes one swatch of a colour wheel, by its place from 0 in wheel order: its label, its colour or its bytes. */
export const typeSwatchUpdate = defineCommand({
  name: "type.swatch.update",
  kind: "authoring",
  description:
    "Change a swatch of a colour wheel, by index from 0: its label, colour or bytes.",
  payload: z
    .object({
      ...parameterRef,
      index: z.number().int().min(0),
      label: z.string().trim().min(1).max(120).optional(),
      color: SwatchColorSchema.optional(),
      bytes: BytesSchema.optional(),
    })
    .strict(),
  label: () => "Change Swatch",
  coalesceKey: ({ typeKey, modeKey, element, attribute, index }) =>
    `type.swatch.update:${typeKey}:${modeKey}:${element}:${attribute}:${String(index)}`,
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      updateSwatch(mode, payload.element, payload.attribute, payload.index, {
        label: payload.label,
        color: payload.color,
        bytes: payload.bytes,
      }),
    );
  },
});
