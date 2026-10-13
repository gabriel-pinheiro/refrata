import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { removeChannel } from "../rig/edits/channels.ts";
import { editMode, modeRef } from "./type-edit.ts";

/** Removes a Channel nothing names; refused, naming it, while a Parameter or an Action does. */
export const typeChannelRemove = defineCommand({
  name: "type.channel.remove",
  kind: "authoring",
  description:
    "Remove a Channel from a Mode; refused while a Parameter or an Action names it, and for the last Channel.",
  payload: z.object({ ...modeRef, channel: z.string().min(1) }).strict(),
  label: () => "Remove Channel",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      removeChannel(mode, payload.channel),
    );
  },
});
