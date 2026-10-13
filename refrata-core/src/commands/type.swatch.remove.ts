import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { removeSwatch } from "../rig/edits/swatches.ts";
import { editMode, parameterRef } from "./type-edit.ts";

/** Removes one swatch of a colour wheel, by its place from 0; refused for the last one. */
export const typeSwatchRemove = defineCommand({
  name: "type.swatch.remove",
  kind: "authoring",
  description:
    "Remove a swatch of a colour wheel, by index from 0; refused for the last swatch.",
  payload: z
    .object({ ...parameterRef, index: z.number().int().min(0) })
    .strict(),
  label: () => "Remove Swatch",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      removeSwatch(mode, payload.element, payload.attribute, payload.index),
    );
  },
});
