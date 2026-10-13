import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { updateChannel } from "../rig/edits/channels.ts";
import { editMode, modeRef } from "./type-edit.ts";

/**
 * Changes a Channel: its name, its width, its Element or its rest byte. A
 * Channel's key is its name, used only inside the Mode, so a rename takes
 * every Encoding and Action that names it along.
 */
export const typeChannelUpdate = defineCommand({
  name: "type.channel.update",
  kind: "authoring",
  description:
    "Change a Channel's name (its key follows, with everything in the Mode that names it), bytes (1 to 3), Element or rest byte.",
  payload: z
    .object({
      ...modeRef,
      channel: z.string().min(1),
      name: z.string().trim().min(1).max(120).optional(),
      bytes: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      element: z.string().min(1).optional(),
      rest: z.number().int().min(0).max(255).optional(),
    })
    .strict(),
  label: () => "Change Channel",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      updateChannel(mode, payload.channel, {
        name: payload.name,
        bytes: payload.bytes,
        element: payload.element,
        rest: payload.rest,
      }),
    );
  },
});
