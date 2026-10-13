import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { removeAction } from "../rig/edits/actions.ts";
import { editMode, modeRef } from "./type-edit.ts";

/** Removes an Action from a Mode; one running on a Fixture of it stops. */
export const typeActionRemove = defineCommand({
  name: "type.action.remove",
  kind: "authoring",
  description: "Remove an Action from a Mode.",
  payload: z.object({ ...modeRef, action: z.string().min(1) }).strict(),
  label: () => "Remove Action",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      removeAction(mode, payload.action),
    );
  },
});
