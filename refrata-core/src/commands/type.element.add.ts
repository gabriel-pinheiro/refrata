import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { addElement } from "../rig/edits/elements.ts";
import { editMode, modeRef } from "./type-edit.ts";

/** Adds an Element last under a parent. Its key comes from its name, made unique, and never changes. */
export const typeElementAdd = defineCommand({
  name: "type.element.add",
  kind: "authoring",
  description:
    "Add an Element to a Mode under a parent (the root unless told); its key comes from its name and is fixed.",
  payload: z
    .object({
      ...modeRef,
      parent: z.string().min(1).optional(),
      name: z.string().trim().min(1).max(120),
    })
    .strict(),
  label: () => "Add Element",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      addElement(mode, { parent: payload.parent, name: payload.name }),
    );
  },
});
