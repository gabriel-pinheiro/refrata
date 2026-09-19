import type { ParameterSchema } from "../parameters.ts";
import { WHITE, type SlotDefinition } from "./sdk.ts";

/**
 * What the envelope Visuals share: a `color` and a `level` Slot, each
 * carrying the Parameter of the same name at an alpha equal to the
 * envelope, so either binding alone or both together make sense.
 */
export function envelopeSlots(
  bound: "color" | "level",
): readonly SlotDefinition[] {
  return [
    {
      key: "color",
      label: "Color",
      kind: "color",
      attribute: bound === "color" ? "color" : null,
    },
    {
      key: "level",
      label: "Level",
      kind: "number",
      attribute: bound === "level" ? "dimmer" : null,
    },
  ];
}

export const envelopeParameters = {
  color: {
    kind: "color",
    label: "Color",
    description: "What the Color Slot shows at the peak.",
    default: WHITE,
  },
  level: {
    kind: "number",
    label: "Level",
    description: "What the Level Slot reaches at the peak.",
    min: 0,
    max: 1,
    step: 0.01,
    percent: true,
    default: 1,
  },
} as const satisfies ParameterSchema;
