import { z, type ZodType } from "zod";

import type { FixtureSetId, Id, LayerId, SceneId } from "../ids.ts";
import { ParameterValueSchema, ParameterValuesSchema } from "../parameters.ts";
import { settings } from "../settings.ts";
import { DEFAULT_ORDER_KEY } from "./order.ts";

/**
 * The composition tables: Scenes, their Layers, and Fixture Sets. A Scene is
 * an ordered stack of Layers, topmost first; a Look Layer holds rows per
 * Target; a Fixture Set is a named, ordered list of Elements that a Layer
 * can Target as one thing. Reasoned in docs/layers-model.md.
 */
const EntityName = z.string().trim().min(1).max(120);

type Branded<TValue, TId> = TValue extends unknown
  ? Omit<TValue, "id"> & { readonly id: TId }
  : never;
type Entity<TSchema extends ZodType, TId extends Id<string>> = Branded<
  z.infer<TSchema>,
  TId
>;

export const SceneSchema = z
  .object({
    id: z.string().min(1),
    name: EntityName,
    order: z.string().min(1).default(DEFAULT_ORDER_KEY),
  })
  .strict();
export type Scene = Entity<typeof SceneSchema, SceneId>;

export const BLEND_MODES = ["normal", "add", "multiply", "max", "min"] as const;
export const BlendModeSchema = z.enum(BLEND_MODES);
export type BlendMode = z.infer<typeof BlendModeSchema>;
export const BLEND_MODE_LABELS: Record<BlendMode, string> = {
  normal: "Normal",
  add: "Add",
  multiply: "Multiply",
  max: "Max (HTP)",
  min: "Min",
};

/** The prefix that tells a Fixture Set Target ref from an Element ref. */
export const SET_REF_PREFIX = "set:";

/**
 * The pseudo Target ref of a Look Layer's "All Targets" rows: what a row
 * command or a row Address names to reach `layer.all` instead of one
 * Target's rows. Never a real Target: an Element ref has a slash and a Set
 * ref its prefix.
 */
export const ALL_TARGETS_REF = "all";

/**
 * One Target entry of a Layer: an Element reference (`<fixtureId>/<key>`)
 * or a Fixture Set (`set:<id>`), and whether it spreads into its members at
 * resolve time, which is what a Visual Layer distributes across; a Look
 * Layer ignores it.
 */
export const TargetSchema = z
  .object({ ref: z.string().min(1), spread: z.boolean().default(false) })
  .strict();
export type Target = z.infer<typeof TargetSchema>;

/** One Look Layer row: a Parameter Value and its alpha; alpha absent means 1. */
export const LookRowSchema = z
  .object({
    value: ParameterValueSchema,
    alpha: z.number().min(0).max(1).optional(),
  })
  .strict();
export type LookRow = z.infer<typeof LookRowSchema>;

/** Rows keyed by Attribute key. A row absent is released. */
export const AttributeRowsSchema = z.record(z.string().min(1), LookRowSchema);
export type AttributeRows = z.infer<typeof AttributeRowsSchema>;

/** Rows keyed by Target ref, then by Attribute key. */
export const LookRowsSchema = z.record(z.string().min(1), AttributeRowsSchema);
export type LookRows = z.infer<typeof LookRowsSchema>;

export const FADE_CURVES = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "bounce",
] as const;
export type FadeCurve = (typeof FADE_CURVES)[number];
export const FADE_CURVE_LABELS: Record<FadeCurve, string> = {
  linear: "Linear",
  "ease-in": "Ease in",
  "ease-out": "Ease out",
  "ease-in-out": "Ease in out",
  bounce: "Bounce",
};

/**
 * One direction of a Layer Fade: how long the envelope takes, in seconds,
 * and along which curve. Zero is a cut.
 */
export const FadeSchema = z
  .object({
    time: z.number().min(0).max(settings.fade.maxSeconds),
    curve: z.enum(FADE_CURVES),
  })
  .strict();
export type Fade = z.infer<typeof FadeSchema>;
export const DEFAULT_FADE: Fade = { time: 0, curve: "linear" };

const LayerBase = {
  id: z.string().min(1),
  name: EntityName,
  sceneId: z.string().min(1),
  /** The Group containing the Layer, or null at the Scene's root. */
  parentId: z.string().min(1).nullable(),
  enabled: z.boolean(),
  /** The Layer's fader; on a Group it scales every Layer inside. */
  opacity: z.number().min(0).max(1).default(1),
  /** Layer Fade: the envelope on enable and on disable. */
  fadeIn: FadeSchema.default(DEFAULT_FADE),
  fadeOut: FadeSchema.default(DEFAULT_FADE),
  /** Position among siblings; the first sorts topmost. */
  order: z.string().min(1).default(DEFAULT_ORDER_KEY),
};

/**
 * A Visual Layer's assignment of one Slot: the Attribute it reaches, or
 * null for none, and for a number Slot the two anchors mapping the Slot's 0
 * and 1 into the Attribute's units. Anchors calibrate to the fixtures and
 * are not Addresses.
 */
export const SlotBindingSchema = z
  .object({
    attribute: z.string().min(1).nullable(),
    from: z.number().optional(),
    to: z.number().optional(),
  })
  .strict();
export type SlotBinding = z.infer<typeof SlotBindingSchema>;

/**
 * The Frame of a Visual Layer running a Geometry Visual: a rectangle in
 * stage space the Visual measures its Targets against, centred at `x`, `y`
 * in metres, `width` and `height` in metres, turned `rotation` degrees
 * about its centre (counterclockwise as the audience sees it). Set once
 * per Layer like a Slot Binding's anchors, never an Address; a Layer of
 * any other Visual has none.
 */
export const FrameSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number(),
  })
  .strict();
export type Frame = z.infer<typeof FrameSchema>;

export const LAYER_KINDS = ["look", "visual", "group"] as const;
export type LayerKind = (typeof LAYER_KINDS)[number];
export const LAYER_LABELS: Record<LayerKind, string> = {
  look: "Look Layer",
  visual: "Visual Layer",
  group: "Group",
};

/**
 * A Layer of a Scene. A Look Layer is the static one: Targets, rows per
 * Target, the "All Targets" rows in `all` that every Target takes unless
 * its own row overrides them, an opacity that is its fader, and a Blend
 * Mode. A Visual Layer runs one Visual of the Catalog over its Targets:
 * the Visual's id, its Parameter Values, one Slot Binding per Slot, and the
 * same opacity and Blend Mode, shared by every Slot; running a Geometry
 * Visual it also has a Frame. A Group has `enabled`,
 * opacity and fades and no Blend Mode: its opacity and envelope multiply
 * into every Layer inside it (pass-through), so a Group at half is every
 * child at half over what is below, not the Group's look at half.
 */
export const LayerSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...LayerBase,
      kind: z.literal("look"),
      targets: z.array(TargetSchema),
      blendMode: BlendModeSchema,
      rows: LookRowsSchema,
      all: AttributeRowsSchema.default({}),
    })
    .strict(),
  z
    .object({
      ...LayerBase,
      kind: z.literal("visual"),
      targets: z.array(TargetSchema),
      blendMode: BlendModeSchema,
      visual: z.string().min(1),
      parameters: ParameterValuesSchema,
      bindings: z.record(z.string().min(1), SlotBindingSchema),
      frame: FrameSchema.optional(),
    })
    .strict(),
  z.object({ ...LayerBase, kind: z.literal("group") }).strict(),
]);
export type Layer = Entity<typeof LayerSchema, LayerId>;
export type LookLayer = Extract<Layer, { kind: "look" }>;
export type VisualLayer = Extract<Layer, { kind: "visual" }>;
/** A Layer with Targets and a Blend Mode: every kind but a Group. */
export type TargetedLayer = LookLayer | VisualLayer;

export function isTargetedLayer(
  layer: Layer | undefined,
): layer is TargetedLayer {
  return layer?.kind === "look" || layer?.kind === "visual";
}

const FixtureSetBase = {
  id: z.string().min(1),
  name: EntityName,
  /** The Group containing the row, or null at the section's root. */
  parentId: z.string().min(1).nullable(),
  order: z.string().min(1).default(DEFAULT_ORDER_KEY),
};

export const FIXTURE_SET_KINDS = ["set", "group"] as const;
export type FixtureSetKind = (typeof FIXTURE_SET_KINDS)[number];
export const FIXTURE_SET_LABELS: Record<FixtureSetKind, string> = {
  set: "Fixture Set",
  group: "Group",
};

/** A Tag as a Rule names it: a person's or a declared Tag, or a Fixture Type key. */
export const RuleTagSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/,
    "must be a Tag (lowercase letters, digits and dashes) or a Fixture Type key",
  );

/** Every Tag an Element must meet, on it or above it; none means every Fixture. */
export const RuleSchema = z.array(RuleTagSchema);
export type Rule = z.infer<typeof RuleSchema>;

/**
 * A Fixture Set is written one of two ways. By list: `members`, an ordered
 * list of Element references from any Fixtures at any depth. By rule:
 * `rules`, an ordered list of Rules resolved live against the Rig, with
 * `members` left empty. It only points; it stores no Parameter Values. A
 * Group only arranges Sets in the navigator.
 */
export const FixtureSetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...FixtureSetBase,
      kind: z.literal("set"),
      members: z.array(z.string().min(1)),
      rules: z.array(RuleSchema).optional(),
    })
    .strict(),
  z.object({ ...FixtureSetBase, kind: z.literal("group") }).strict(),
]);
export type FixtureSet = Entity<typeof FixtureSetSchema, FixtureSetId>;
export type MemberSet = Extract<FixtureSet, { kind: "set" }>;

export function isSetRef(ref: string): boolean {
  return ref.startsWith(SET_REF_PREFIX);
}

/** Whether a ref names the "All Targets" rows rather than one Target. */
export function isAllTargetsRef(ref: string): boolean {
  return ref === ALL_TARGETS_REF;
}

/** `set:<id>`: how a Fixture Set is named as a Target. */
export function setRef(setId: string): string {
  return `${SET_REF_PREFIX}${setId}`;
}

/** The Set id inside a `set:<id>` ref, or undefined for an Element ref. */
export function parseSetRef(ref: string): string | undefined {
  return isSetRef(ref) ? ref.slice(SET_REF_PREFIX.length) : undefined;
}
