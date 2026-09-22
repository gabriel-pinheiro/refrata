import type { Color, ParameterKind } from "../parameters.ts";

/**
 * The fixed vocabulary of controllable things. A Parameter in a Fixture
 * Type names one of these and inherits its kind, unit, range and default,
 * so "the dimmer of everything selected" means one thing across brands.
 * The family only groups rows in Studio. Encoding switches on the key.
 * Order is the order rows appear in, family by family.
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
  /**
   * An open choice takes its options from the Fixture Type (a gobo wheel's
   * slots, a control channel's functions); a closed one offers the
   * vocabulary's list on every fixture, so "open" means one thing.
   */
  readonly open?: boolean;
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
    default: [0, 0, 0, 1],
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
  prism: {
    key: "prism",
    label: "Prism",
    family: "beam",
    kind: "boolean",
    default: false,
  },
  "prism-rotation": {
    key: "prism-rotation",
    label: "Prism rotation",
    family: "beam",
    kind: "number",
    min: 0,
    max: 1,
    percent: true,
    default: 0,
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
  gobo1: {
    key: "gobo1",
    label: "Gobo",
    family: "gobo",
    kind: "choice",
    options: [{ value: "open", label: "Open" }],
    default: "open",
    open: true,
  },
  "gobo1-shake": {
    key: "gobo1-shake",
    label: "Gobo shake",
    family: "gobo",
    kind: "number",
    min: 0,
    max: 1,
    percent: true,
    default: 0,
  },
  control: {
    key: "control",
    label: "Control",
    family: "control",
    kind: "choice",
    options: [{ value: "none", label: "No function" }],
    default: "none",
    open: true,
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
