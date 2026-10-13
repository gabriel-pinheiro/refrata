import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { addMode } from "../rig/edits/modes.ts";
import { editType, typeRef } from "./type-edit.ts";

/** Adds a Mode to a Fixture Type: blank, or a copy of another of its Modes. Its key comes from its name and never changes. */
export const typeModeAdd = defineCommand({
  name: "type.mode.add",
  kind: "authoring",
  description:
    "Add a Mode to a Fixture Type: one Channel on a root Element, or a copy of the Mode `from` names.",
  payload: z
    .object({
      ...typeRef,
      name: z.string().trim().min(1).max(120),
      from: z.string().min(1).optional(),
    })
    .strict(),
  label: () => "Add Mode",
  apply({ document, payload }) {
    return editType(document, payload.typeKey, (type) =>
      addMode(type, { name: payload.name, from: payload.from }),
    );
  },
});
