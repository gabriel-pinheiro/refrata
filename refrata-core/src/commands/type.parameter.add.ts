import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { addParameter } from "../rig/edits/parameters.ts";
import { editMode, parameterRef } from "./type-edit.ts";

/**
 * Gives an Element a Parameter of an Attribute, filled in so the type
 * stays valid: the first Encoding rule that reads the Attribute's kind,
 * pointed at the Element's Channels, with a first option or swatch where
 * the rule needs one.
 */
export const typeParameterAdd = defineCommand({
  name: "type.parameter.add",
  kind: "authoring",
  description:
    "Add a Parameter of an Attribute to an Element, with a first Encoding on the Element's Channels; refused on an Element with no Channel.",
  payload: z.object({ ...parameterRef }).strict(),
  label: () => "Add Parameter",
  apply({ document, payload }) {
    return editMode(document, payload, (mode) =>
      addParameter(mode, payload.element, payload.attribute),
    );
  },
});
