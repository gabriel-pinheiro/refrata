import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { removeOption } from "../rig/edits/options.ts";
import { editMode, parameterRef } from "./type-edit.ts";

/** Removes an option, with the range a `spread` holds for it; refused for the last one. */
export const typeOptionRemove = defineCommand({
  name: "type.option.remove",
  kind: "authoring",
  description:
    "Remove an option of an open choice Parameter, with the range a spread holds for it; refused for the last option.",
  payload: z.object({ ...parameterRef, option: z.string().min(1) }).strict(),
  label: () => "Remove Option",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      removeOption(mode, payload.element, payload.attribute, payload.option),
    );
  },
});
