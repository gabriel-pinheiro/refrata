import { z, type ZodType } from "zod";

import type { FixtureSetId, Id, LayerId, SceneId } from "../ids.ts";
import { ParameterValueSchema } from "../parameters.ts";
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
 * resolve time. Spread is stored for Visual Layers to come; a Look Layer
 * ignores it.
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

const LayerBase = {
  id: z.string().min(1),
  name: EntityName,
  sceneId: z.string().min(1),
  /** The Group containing the Layer, or null at the Scene's root. */
  parentId: z.string().min(1).nullable(),
  enabled: z.boolean(),
  /** Position among siblings; the first sorts topmost. */
  order: z.string().min(1).default(DEFAULT_ORDER_KEY),
};

export const LAYER_KINDS = ["look", "group"] as const;
export type LayerKind = (typeof LAYER_KINDS)[number];
export const LAYER_LABELS: Record<LayerKind, string> = {
  look: "Look Layer",
  group: "Group",
};

/**
 * A Layer of a Scene. A Look Layer is the static one: Targets, rows per
 * Target, the "All Targets" rows in `all` that every Target takes unless
 * its own row overrides them, an opacity that is its fader, and a Blend
 * Mode. A Group has `enabled` and nothing else, so a submaster is a
 * Controller on the opacities it should ride.
 */
export const LayerSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...LayerBase,
      kind: z.literal("look"),
      targets: z.array(TargetSchema),
      opacity: z.number().min(0).max(1),
      blendMode: BlendModeSchema,
      rows: LookRowsSchema,
      all: AttributeRowsSchema.default({}),
    })
    .strict(),
  z.object({ ...LayerBase, kind: z.literal("group") }).strict(),
]);
export type Layer = Entity<typeof LayerSchema, LayerId>;
export type LookLayer = Extract<Layer, { kind: "look" }>;

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

/**
 * A Fixture Set by list: an ordered list of Element references, from any
 * Fixtures at any depth. It only points; it stores no Parameter Values. A
 * Group only arranges Sets in the navigator.
 */
export const FixtureSetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...FixtureSetBase,
      kind: z.literal("set"),
      members: z.array(z.string().min(1)),
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
