import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { editType, typeRef } from "./type-edit.ts";

/** Changes a Fixture Type's manufacturer, model or notes. Its key stays as it was made. */
export const typeUpdate = defineCommand({
  name: "type.update",
  kind: "authoring",
  description:
    "Change a Fixture Type's manufacturer, model or notes; empty notes are removed. The key does not follow a rename.",
  payload: z
    .object({
      ...typeRef,
      manufacturer: z.string().trim().min(1).max(120).optional(),
      model: z.string().trim().min(1).max(120).optional(),
      notes: z.string().optional(),
    })
    .strict(),
  label: () => "Change Fixture Type",
  coalesceKey: ({ typeKey }) => `type.update:${typeKey}`,
  apply({ document, payload }) {
    return editType(document, payload.typeKey, (type) => {
      const { notes: oldNotes, ...rest } = type;
      const notes =
        payload.notes === undefined ? oldNotes : payload.notes.trim();
      return {
        ...rest,
        manufacturer: payload.manufacturer ?? type.manufacturer,
        model: payload.model ?? type.model,
        ...(notes === undefined || notes === "" ? {} : { notes }),
      };
    });
  },
});
