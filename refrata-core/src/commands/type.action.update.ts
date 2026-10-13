import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { updateAction } from "../rig/edits/actions.ts";
import { editMode, modeRef } from "./type-edit.ts";

/** Changes an Action's name (its key stays), Channel, byte or seconds. */
export const typeActionUpdate = defineCommand({
  name: "type.action.update",
  kind: "authoring",
  description:
    "Change an Action's name, Channel, byte or seconds; its key does not follow a rename.",
  payload: z
    .object({
      ...modeRef,
      action: z.string().min(1),
      name: z.string().trim().min(1).max(120).optional(),
      channel: z.string().min(1).optional(),
      byte: z.number().int().min(0).max(255).optional(),
      seconds: z.number().positive().optional(),
    })
    .strict(),
  label: () => "Change Action",
  coalesceKey: ({ typeKey, modeKey, action }) =>
    `type.action.update:${typeKey}:${modeKey}:${action}`,
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      updateAction(mode, payload.action, {
        ...(payload.name === undefined ? {} : { name: payload.name }),
        ...(payload.channel === undefined ? {} : { channel: payload.channel }),
        ...(payload.byte === undefined ? {} : { byte: payload.byte }),
        ...(payload.seconds === undefined ? {} : { seconds: payload.seconds }),
      }),
    );
  },
});
