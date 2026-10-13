import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { removeParameter } from "../rig/edits/parameters.ts";
import { editMode, parameterRef } from "./type-edit.ts";

/** Removes a Parameter from an Element; refused, naming it, while a `spread` follows it. */
export const typeParameterRemove = defineCommand({
  name: "type.parameter.remove",
  kind: "authoring",
  description:
    "Remove a Parameter from an Element; refused while a spread follows it.",
  payload: z.object({ ...parameterRef }).strict(),
  label: () => "Remove Parameter",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      removeParameter(mode, payload.element, payload.attribute),
    );
  },
});
