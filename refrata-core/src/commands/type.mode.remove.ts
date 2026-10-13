import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { removeMode } from "../rig/edits/modes.ts";
import { editType, modeRef } from "./type-edit.ts";

/** Removes a Mode, refused for a type's last Mode and for one a Fixture is on. */
export const typeModeRemove = defineCommand({
  name: "type.mode.remove",
  kind: "authoring",
  description:
    "Remove a Mode of a Fixture Type; refused for its last Mode and while a Fixture is on it.",
  payload: z.object({ ...modeRef }).strict(),
  label: () => "Remove Mode",
  apply({ document, payload }) {
    return editType(document, payload.typeKey, (type) =>
      removeMode(type, payload.modeKey),
    );
  },
});
