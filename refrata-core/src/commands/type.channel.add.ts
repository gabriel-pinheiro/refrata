import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { addChannel } from "../rig/edits/channels.ts";
import { editMode, modeRef } from "./type-edit.ts";

/** Adds a Channel at the end of a Mode's Channel Layout. Fixtures on the Mode need room for the wider Footprint. */
export const typeChannelAdd = defineCommand({
  name: "type.channel.add",
  kind: "authoring",
  description:
    "Add a Channel at the end of a Mode's Channel Layout, on an Element (the root unless told); one byte and named channel-<n> unless told.",
  payload: z
    .object({
      ...modeRef,
      element: z.string().min(1).optional(),
      name: z.string().trim().min(1).max(120).optional(),
      bytes: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    })
    .strict(),
  label: () => "Add Channel",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      addChannel(mode, {
        element: payload.element,
        name: payload.name,
        bytes: payload.bytes,
      }),
    );
  },
});
