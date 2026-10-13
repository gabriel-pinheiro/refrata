import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { addSwatch } from "../rig/edits/swatches.ts";
import { BytesSchema, editMode, parameterRef } from "./type-edit.ts";

export const SwatchColorSchema = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
]);

/** Adds a swatch at the end of a colour wheel: white, starting where the highest range ends, unless told. */
export const typeSwatchAdd = defineCommand({
  name: "type.swatch.add",
  kind: "authoring",
  description:
    "Add a swatch at the end of a colour wheel: a label, a colour (red, green, blue from 0 to 1) and its bytes.",
  payload: z
    .object({
      ...parameterRef,
      label: z.string().trim().min(1).max(120).optional(),
      color: SwatchColorSchema.optional(),
      bytes: BytesSchema.optional(),
    })
    .strict(),
  label: () => "Add Swatch",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      addSwatch(mode, payload.element, payload.attribute, {
        label: payload.label,
        color: payload.color,
        bytes: payload.bytes,
      }),
    );
  },
});
