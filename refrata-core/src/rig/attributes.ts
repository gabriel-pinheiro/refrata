import type { Color, ParameterKind } from "../parameters.ts";

/**
 * The fixed vocabulary of controllable things. A Parameter in a Fixture
 * Type names one of these and inherits its kind, unit, range and default,
 * so "the dimmer of everything selected" means one thing across brands.
 * The family only groups rows in Studio. Encoding switches on the key.
 */
export type AttributeFamily =
  "intensity" | "color" | "position" | "beam" | "gobo" | "control";

interface AttributeBase {
  readonly key: string;
  readonly label: string;
  readonly family: AttributeFamily;
}

export interface NumberAttribute extends AttributeBase {
  readonly kind: "number";
  readonly min: number;
  readonly max: number;
  readonly unit?: string;
  readonly percent?: boolean;
  readonly default: number;
}

export interface ColorAttribute extends AttributeBase {
  readonly kind: "color";
  readonly default: Color;
}

export interface ChoiceAttribute extends AttributeBase {
  readonly kind: "choice";
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly default: string;
}

export interface BooleanAttribute extends AttributeBase {
  readonly kind: "boolean";
  readonly default: boolean;
}

export type AttributeDefinition =
  NumberAttribute | ColorAttribute | ChoiceAttribute | BooleanAttribute;

export const ATTRIBUTES = {
  dimmer: {
    key: "dimmer",
    label: "Dimmer",
    family: "intensity",
    kind: "number",
    min: 0,
    max: 1,
    percent: true,
    default: 0,
  },
  color: {
    key: "color",
    label: "Color",
    family: "color",
    kind: "color",
    default: [1, 1, 1, 1],
  },
  strobe: {
    key: "strobe",
    label: "Strobe",
    family: "beam",
    kind: "number",
    min: 0,
    max: 30,
    unit: "Hz",
    default: 0,
  },
  shutter: {
    key: "shutter",
    label: "Shutter",
    family: "beam",
    kind: "choice",
    options: [
      { value: "closed", label: "Closed" },
      { value: "open", label: "Open" },
    ],
    default: "open",
  },
  pan: {
    key: "pan",
    label: "Pan",
    family: "position",
    kind: "number",
    min: -270,
    max: 270,
    unit: "°",
    default: 0,
  },
  tilt: {
    key: "tilt",
    label: "Tilt",
    family: "position",
    kind: "number",
    min: -135,
    max: 135,
    unit: "°",
    default: 0,
  },
  control: {
    key: "control",
    label: "Control",
    family: "control",
    kind: "choice",
    options: [{ value: "none", label: "No function" }],
    default: "none",
  },
} as const satisfies Record<string, AttributeDefinition>;

export type AttributeKey = keyof typeof ATTRIBUTES;

export const ATTRIBUTE_KEYS = Object.keys(
  ATTRIBUTES,
) as readonly AttributeKey[];

export function isAttributeKey(key: string): key is AttributeKey {
  return key in ATTRIBUTES;
}

export function attributeOf(key: AttributeKey): AttributeDefinition {
  return ATTRIBUTES[key];
}

export function attributeKind(key: AttributeKey): ParameterKind {
  return ATTRIBUTES[key].kind;
}
