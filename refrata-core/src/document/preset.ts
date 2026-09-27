import { z, type ZodType } from "zod";

import type { Id, PresetId } from "../ids.ts";
import { ParameterValueSchema } from "../parameters.ts";
import { DEFAULT_ORDER_KEY } from "./order.ts";

type Branded<TValue, TId> = TValue extends unknown
  ? Omit<TValue, "id"> & { readonly id: TId }
  : never;
type Entity<TSchema extends ZodType, TId extends Id<string>> = Branded<
  z.infer<TSchema>,
  TId
>;

const PresetBase = {
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  /** The Group containing the Preset, or null at the section's root. */
  parentId: z.string().min(1).nullable(),
  order: z.string().min(1).default(DEFAULT_ORDER_KEY),
};

export const PRESET_KINDS = ["preset", "group"] as const;
export type PresetKind = (typeof PRESET_KINDS)[number];
export const PRESET_LABELS: Record<PresetKind, string> = {
  preset: "Preset",
  group: "Group",
};

/** One Preset row: a Parameter Value. A row absent is released. */
export const PresetRowSchema = z
  .object({ value: ParameterValueSchema })
  .strict();
export type PresetRow = z.infer<typeof PresetRowSchema>;

const PresetRowsSchema = z.record(z.string().min(1), PresetRowSchema);

/**
 * A Preset is a named bundle of Parameter Values that Look Layer rows link
 * to instead of holding their own. It has the shape of a Look Layer's
 * content and no place in a stack: `elements`, the ordered Element
 * references it has rows for; `rows`, by Element reference then by
 * Attribute; and `all`, the rows every Element takes unless its own row
 * overrides them. It belongs to no Scene. A Group only arranges Presets in
 * the navigator.
 */
export const PresetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...PresetBase,
      kind: z.literal("preset"),
      elements: z.array(z.string().min(1)),
      rows: z.record(z.string().min(1), PresetRowsSchema),
      all: PresetRowsSchema.default({}),
    })
    .strict(),
  z.object({ ...PresetBase, kind: z.literal("group") }).strict(),
]);
export type Preset = Entity<typeof PresetSchema, PresetId>;
export type ValuePreset = Extract<Preset, { kind: "preset" }>;
