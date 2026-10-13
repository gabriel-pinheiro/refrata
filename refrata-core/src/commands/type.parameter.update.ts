import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { ParameterValueSchema } from "../parameters.ts";
import { changeAttribute, updateParameter } from "../rig/edits/parameters.ts";
import { SettleTimeSchema } from "../rig/fixture-type.ts";
import { editMode, parameterRef } from "./type-edit.ts";

/**
 * Changes what a Parameter declares: its Attribute (`to`; one of the same
 * kind keeps the Encoding, another kind starts fresh), its Default, its
 * Highlight, a number's lowest, highest and unit, its notes, and a wheel's
 * Settle time. Null takes a value away.
 */
export const typeParameterUpdate = defineCommand({
  name: "type.parameter.update",
  kind: "authoring",
  description:
    "Change a Parameter's Attribute (to), default, highlight, a number's min, max and unit, notes, or a wheel's settle time; null removes default, highlight, min, max or settle.",
  payload: z
    .object({
      ...parameterRef,
      to: z.string().min(1).optional(),
      default: ParameterValueSchema.nullable().optional(),
      highlight: ParameterValueSchema.nullable().optional(),
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
      unit: z.string().max(16).optional(),
      notes: z.string().optional(),
      settle: SettleTimeSchema.nullable().optional(),
    })
    .strict(),
  label: () => "Change Parameter",
  coalesceKey: ({ typeKey, modeKey, element, attribute, to }) =>
    to === undefined
      ? `type.parameter.update:${typeKey}:${modeKey}:${element}:${attribute}`
      : undefined,
  apply({ document, payload }) {
    const { typeKey, modeKey, element, attribute, to, ...change } = payload;
    return editMode(document, { typeKey, modeKey }, (mode) => {
      const moved =
        to === undefined ? mode : changeAttribute(mode, element, attribute, to);
      if ("error" in moved) return moved;
      return Object.keys(change).length === 0
        ? moved
        : updateParameter(moved, element, to ?? attribute, change);
    });
  },
});
