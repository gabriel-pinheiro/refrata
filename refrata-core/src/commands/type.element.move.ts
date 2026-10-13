import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { moveElement } from "../rig/edits/elements.ts";
import { editMode, modeRef } from "./type-edit.ts";

/** Moves an Element among its siblings or under another parent, never under itself or its own descendants. */
export const typeElementMove = defineCommand({
  name: "type.element.move",
  kind: "authoring",
  description:
    "Move an Element among its siblings or under another parent: after a sibling, first with after null, last when after is left out.",
  payload: z
    .object({
      ...modeRef,
      element: z.string().min(1),
      /** The parent to land under; its own when left out. */
      parent: z.string().min(1).optional(),
      /** Sibling to land after; null for first, absent for last. */
      after: z.string().min(1).nullable().optional(),
    })
    .strict(),
  label: () => "Move Element",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      moveElement(mode, payload.element, {
        parent: payload.parent,
        after: payload.after,
      }),
    );
  },
});
