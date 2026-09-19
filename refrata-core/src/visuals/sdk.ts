import type { Color, ParameterSchema, ParameterValues } from "../parameters.ts";
import type { AttributeKey } from "../rig/attributes.ts";

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

export interface VisualFrame {
  /** Seconds since the previous frame, clamped to `settings.visuals.maxFrameSeconds`. */
  readonly dt: number;
  readonly params: ParameterValues;
  /** In the order the Layer lists them; a Set in its own order. */
  readonly targets: readonly VisualTarget[];
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

/** The top of every rate Parameter, in hertz, so one tempo Controller links to all of them alike. */
export const RATE_MAX_HZ = 20;
export const WHITE: Color = [1, 1, 1, 1];
