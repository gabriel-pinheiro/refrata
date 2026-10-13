import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { addAction } from "../rig/edits/actions.ts";
import { editMode, modeRef } from "./type-edit.ts";

/** Adds an Action to a Mode. Its key comes from its name, made unique, and never changes: it is part of the Action's Address. */
export const typeActionAdd = defineCommand({
  name: "type.action.add",
  kind: "authoring",
  description:
    "Add an Action to a Mode: a name, and unless told byte 255 on the last Channel for 5 seconds. Its key comes from its name and is fixed.",
  payload: z
    .object({
      ...modeRef,
      name: z.string().trim().min(1).max(120),
      channel: z.string().min(1).optional(),
      byte: z.number().int().min(0).max(255).optional(),
      seconds: z.number().positive().optional(),
    })
    .strict(),
  label: () => "Add Action",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      addAction(mode, {
        name: payload.name,
        channel: payload.channel,
        byte: payload.byte,
        seconds: payload.seconds,
      }),
    );
  },
});
