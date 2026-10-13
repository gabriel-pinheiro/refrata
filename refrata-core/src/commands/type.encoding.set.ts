import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { setEncoding } from "../rig/edits/encoding.ts";
import { ENCODE_RULES } from "../rig/rules.ts";
import { BytesSchema, editMode, parameterRef } from "./type-edit.ts";

/**
 * Changes a Parameter's Encoding. `rule` starts it fresh on the Element's
 * first Channels, among the rules that read the Attribute's kind; the
 * other fields each belong to some rules: `channel` to Scale, Wheel, Range
 * and Switch; `channels` to Color and Multiply; `dims` to Wheel; `on` and
 * `off` to Switch; `follows` and `ranges` to Spread.
 */
export const typeEncodingSet = defineCommand({
  name: "type.encoding.set",
  kind: "authoring",
  description:
    "Change a Parameter's Encoding: its rule (scale, multiply, spread, color, wheel, range, switch), its Channels (channel, channels, dims), a switch's on and off ranges, and what a spread follows with its ranges by value (null removes one).",
  payload: z
    .object({
      ...parameterRef,
      rule: z.enum(ENCODE_RULES).optional(),
      channel: z.string().min(1).optional(),
      channels: z.array(z.string().min(1)).optional(),
      dims: z.array(z.string().min(1)).optional(),
      follows: z.string().min(1).optional(),
      on: BytesSchema.optional(),
      off: BytesSchema.optional(),
      ranges: z.record(z.string().min(1), BytesSchema.nullable()).optional(),
    })
    .strict(),
  label: () => "Change Encoding",
  coalesceKey: ({ typeKey, modeKey, element, attribute, rule }) =>
    rule === undefined
      ? `type.encoding.set:${typeKey}:${modeKey}:${element}:${attribute}`
      : undefined,
  apply({ document, payload }) {
    const { typeKey, modeKey, element, attribute, ...change } = payload;
    return editMode(document, { typeKey, modeKey }, (mode) =>
      setEncoding(mode, element, attribute, change),
    );
  },
});
