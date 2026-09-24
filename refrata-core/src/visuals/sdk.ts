import type { BlendMode } from "../document/composition.ts";
import type {
  Color,
  NumberParameter,
  ParameterSchema,
  ParameterValues,
} from "../parameters.ts";
import { ATTRIBUTES, type AttributeKey } from "../rig/attributes.ts";

/**
 * The Visual SDK. A Visual is a definition (Slots with default bindings, a
 * Parameter Schema, Cues, a one-line description) and a `create` returning
 * an instance. The instance owns its state and integrates `dt`; it never
 * sees absolute time, a fixture, a Tag or a Position. Reasoned in
 * docs/visuals-and-links.md §5.
 */
export type SlotKind = "number" | "color";

/** One typed output of a Visual. A number leaves it in 0 to 1. */
export interface SlotDefinition {
  readonly key: string;
  readonly label: string;
  readonly kind: SlotKind;
  /** The Attribute a new Layer binds the Slot to; null leaves it unbound. */
  readonly attribute: AttributeKey | null;
}

/** A named trigger the Visual answers: the Address `layer/<id>/cue/<key>`. */
export interface CueDefinition {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
}

/** One of the Layer's Targets after Spread, as a Visual sees it. */
export interface VisualTarget {
  /** Stable across frames and across Targets coming and going; state per Target is kept by it. */
  readonly key: string;
  readonly index: number;
  readonly count: number;
}

/** A Target as a Geometry Visual sees it: with its point in Frame space, metres from the Frame's centre. */
export interface GeometryTarget extends VisualTarget {
  /** Along the Frame's width, positive to the right. */
  readonly x: number;
  /** Along the Frame's height, positive up. */
  readonly y: number;
}

/** The Frame's size, metres, as a Geometry Visual sees it. */
export interface FrameSize {
  readonly width: number;
  readonly height: number;
}

/** What the Runtime adds to a frame for a Geometry Visual whose Layer has a Frame. */
export interface GeometryInput extends FrameSize {
  readonly targets: readonly GeometryTarget[];
}

export interface VisualFrame {
  /** Seconds since the previous frame, clamped to `settings.visuals.maxFrameSeconds`. */
  readonly dt: number;
  readonly params: ParameterValues;
  /** In the order the Layer lists them; a Set in its own order. */
  readonly targets: readonly VisualTarget[];
  /** Present for a Geometry Visual on a Layer with a Frame; absent, it releases everything. */
  readonly geometry?: GeometryInput;
}

/** The small serializable state a Geometry Visual reports each frame, from which its figure is drawn. */
export type Pose = Readonly<Record<string, number | readonly number[]>>;

/**
 * One path of a Geometry Visual's figure, in Frame space (metres from the
 * Frame's centre, `y` up). Filled at `alpha` in the selection colour, or
 * in `color`; with `strokeWidth` it is stroked that wide, in metres,
 * instead of filled.
 */
export interface FigurePath {
  readonly d: string;
  readonly alpha: number;
  readonly color?: Color;
  readonly strokeWidth?: number;
}

/** What makes a Visual a Geometry Visual: a pure drawing of its pose. */
export interface GeometryDefinition {
  /** The figure the Rig View draws for a Layer of it, from the Layer's Parameters and the instance's pose. */
  figure(
    params: ParameterValues,
    pose: Pose,
    size: FrameSize,
  ): readonly FigurePath[];
}

/**
 * Writes one Slot's value for one Target this frame, at an alpha. A Target
 * a Visual writes nothing for is released.
 */
export type Emit = (
  slot: string,
  target: VisualTarget,
  value: number | Color,
  alpha?: number,
) => void;

export interface VisualInstance {
  update(frame: VisualFrame, emit: Emit): void;
  /** Called before the next `update` for each Cue fired since the last one. */
  cue?(key: string): void;
  dispose?(): void;
  /** A Geometry Visual's pose after the last `update`, streamed to a Rig View showing its Layer. */
  pose?(): Pose;
}

export interface VisualContext {
  /** Uniform in [0, 1); injected so tests are repeatable. */
  readonly random: () => number;
}

export interface VisualDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly slots: readonly SlotDefinition[];
  readonly parameters: ParameterSchema;
  readonly cues: readonly CueDefinition[];
  /** Whether it does something different per Target, so one Target after Spread deserves a warning. */
  readonly distributes: boolean;
  /** The Blend Mode a new Layer of it starts with; Normal when absent. A Visual that gates what is below asks for Multiply. */
  readonly blendMode?: BlendMode;
  /** Present on a Geometry Visual: it reads where its Targets are in its Layer's Frame. */
  readonly geometry?: GeometryDefinition;
  create(context: VisualContext): VisualInstance;
}

export function defineVisual(definition: VisualDefinition): VisualDefinition {
  return definition;
}

/** A number Parameter's value this frame, or its fallback when the frame holds something else. */
export function numberParam(
  params: ParameterValues,
  name: string,
  fallback: number,
): number {
  const value = params[name];
  return typeof value === "number" ? value : fallback;
}

export function colorParam(
  params: ParameterValues,
  name: string,
  fallback: Color,
): Color {
  const value = params[name];
  return Array.isArray(value) ? (value as Color) : fallback;
}

export function choiceParam(
  params: ParameterValues,
  name: string,
  fallback: string,
): string {
  const value = params[name];
  return typeof value === "string" ? value : fallback;
}

/** `from` at 0, `to` at 1, every channel alike. */
export function mixColor(from: Color, to: Color, amount: number): Color {
  const t = Math.min(1, Math.max(0, amount));
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
    from[3] + (to[3] - from[3]) * t,
  ];
}

export function booleanParam(
  params: ParameterValues,
  name: string,
  fallback: boolean,
): boolean {
  const value = params[name];
  return typeof value === "boolean" ? value : fallback;
}

/** The top of every rate Parameter, in hertz, so one tempo Controller links to all of them alike. */
export const RATE_MAX_HZ = 20;

/**
 * A number Slot in degrees on a position Attribute. It writes over the
 * Attribute's whole range, which is what a new Layer binds, so a Parameter
 * of 10° moves the beam 10° at the default binding and a Layer that
 * rebinds scales it.
 */
export function degreesSlot(
  key: string,
  label: string,
  attribute: AttributeKey,
): SlotDefinition {
  return { key, label, kind: "number", attribute };
}

/** Degrees as a degrees Slot on `attribute` writes them, clamped at the Attribute's range. */
export function unitOfDegrees(
  attribute: AttributeKey,
  degrees: number,
): number {
  const definition = ATTRIBUTES[attribute];
  if (definition.kind !== "number") return 0.5;
  const { min, max } = definition;
  return Math.min(1, Math.max(0, (degrees - min) / (max - min)));
}

/** A number Parameter in degrees, on a whole-degree grid. */
export function degreesParam(
  label: string,
  min: number,
  max: number,
  fallback: number,
  description?: string,
): NumberParameter {
  return {
    kind: "number",
    label,
    ...(description === undefined ? {} : { description }),
    min,
    max,
    step: 1,
    unit: "°",
    default: fallback,
  };
}
export const WHITE: Color = [1, 1, 1, 1];
