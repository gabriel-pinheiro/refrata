import type { ParameterKind } from "../parameters.ts";
import {
  ATTRIBUTE_KEYS,
  attributeOf,
  type AttributeKey,
} from "./attributes.ts";
import type { Encode } from "./encode-rules.ts";

/** The Encoding primitives by the name the file gives them. */
export const ENCODE_RULES = [
  "scale",
  "multiply",
  "spread",
  "color",
  "wheel",
  "range",
  "switch",
] as const;
export type EncodeRule = (typeof ENCODE_RULES)[number];

/** Each rule: the kind of Parameter it reads and what it does, in a line. */
export const RULES: Record<
  EncodeRule,
  {
    readonly label: string;
    readonly reads: ParameterKind;
    readonly summary: string;
  }
> = {
  scale: {
    label: "Scale",
    reads: "number",
    summary: "One Channel carries the value, spread over all its bytes.",
  },
  multiply: {
    label: "Multiply",
    reads: "number",
    summary:
      "No Channel of its own. The value scales the Channels listed, a virtual dimmer.",
  },
  spread: {
    label: "Spread",
    reads: "number",
    summary:
      "Shares a Channel with another Parameter. Above zero, the value runs along the byte range that Parameter's current value picks.",
  },
  color: {
    label: "Color",
    reads: "color",
    summary:
      "Red, green and blue Channels, and an optional white taken out of the three.",
  },
  wheel: {
    label: "Wheel",
    reads: "color",
    summary:
      "One Channel selects the nearest swatch. The colour's brightness can dim other Channels.",
  },
  range: {
    label: "Range",
    reads: "choice",
    summary: "One Channel, with a byte range per option.",
  },
  switch: {
    label: "Switch",
    reads: "boolean",
    summary: "One Channel, with a byte range for off and one for on.",
  },
};

/** The rule an Encoding is written with. */
export function ruleOf(encode: Encode): EncodeRule {
  if ("scale" in encode) return "scale";
  if ("color" in encode) return "color";
  if ("wheel" in encode) return "wheel";
  if ("multiply" in encode) return "multiply";
  if ("range" in encode) return "range";
  if ("switch" in encode) return "switch";
  return "spread";
}

/** The rules that read a Parameter kind, the first being what a new Parameter starts with. */
export function rulesFor(kind: ParameterKind): readonly EncodeRule[] {
  return ENCODE_RULES.filter((rule) => RULES[rule].reads === kind);
}

/** Whether a Mode can declare the Attribute: a closed choice has no rule that reads it. */
export function isEncodable(attribute: AttributeKey): boolean {
  const definition = attributeOf(attribute);
  return definition.kind !== "choice" || definition.open === true;
}

/** The Attributes a Mode can declare, in the vocabulary's order. */
export const ENCODABLE_ATTRIBUTES: readonly AttributeKey[] =
  ATTRIBUTE_KEYS.filter(isEncodable);
