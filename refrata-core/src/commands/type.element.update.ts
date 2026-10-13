import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { updateElement } from "../rig/edits/elements.ts";
import { editMode, modeRef } from "./type-edit.ts";

/** Renames an Element (its key stays) or replaces the Tags its Mode declares for it. */
export const typeElementUpdate = defineCommand({
  name: "type.element.update",
  kind: "authoring",
  description:
    "Change an Element's name or the Tags the Mode declares for it; its key does not follow a rename.",
  payload: z
    .object({
      ...modeRef,
      element: z.string().min(1),
      name: z.string().trim().min(1).max(120).optional(),
      tags: z.array(z.string().min(1)).optional(),
    })
    .strict(),
  label: () => "Change Element",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      updateElement(mode, payload.element, {
        name: payload.name,
        tags: payload.tags,
      }),
    );
  },
});
