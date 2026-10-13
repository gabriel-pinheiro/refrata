import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { moveChannel } from "../rig/edits/channels.ts";
import { editMode, modeRef } from "./type-edit.ts";

/** Moves a Channel earlier or later in its Mode's Channel Layout: after another Channel, or first. */
export const typeChannelMove = defineCommand({
  name: "type.channel.move",
  kind: "authoring",
  description:
    "Move a Channel within its Mode's Channel Layout, to right after another Channel or to the front.",
  payload: z
    .object({
      ...modeRef,
      channel: z.string().min(1),
      /** Channel to land after; null for the front. */
      after: z.string().min(1).nullable(),
    })
    .strict(),
  label: () => "Move Channel",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      moveChannel(mode, payload.channel, payload.after),
    );
  },
});
