import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { removeElement } from "../rig/edits/elements.ts";
import { editMode, modeRef } from "./type-edit.ts";

/**
 * Removes an Element with everything under it: their Channels go to its
 * parent and their Parameters go with them. On Fixtures of the Mode, what
 * pointed at those Elements goes too, as one undo step.
 */
export const typeElementRemove = defineCommand({
  name: "type.element.remove",
  kind: "authoring",
  description:
    "Remove an Element with its descendants; their Channels go to its parent, their Parameters go, and Fixtures of the Mode drop what pointed at them.",
  payload: z.object({ ...modeRef, element: z.string().min(1) }).strict(),
  label: () => "Remove Element",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      removeElement(mode, payload.element),
    );
  },
});
