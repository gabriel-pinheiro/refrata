import { z, type ZodType } from "zod";

import type {
  FixtureId,
  FixtureTypeId,
  Id,
  OutputId,
  UniverseId,
} from "../ids.ts";
import { FixtureTypeSchema } from "../rig/fixture-type.ts";
import { DEFAULT_ORDER_KEY } from "./order.ts";

/**
 * The Rig tables: Universes, Outputs, the Fixture Types copied in, and
 * Fixtures with their navigator Groups. Elements are not rows; a Fixture's
 * Element tree is derived from its Mode (see `rig/elements.ts`).
 */
const EntityName = z.string().trim().min(1).max(120);

type Branded<TValue, TId> = TValue extends unknown
  ? Omit<TValue, "id"> & { readonly id: TId }
  : never;
type Entity<TSchema extends ZodType, TId extends Id<string>> = Branded<
  z.infer<TSchema>,
  TId
>;

/** A named bank of 512 DMX Addresses; the wire number lives on its Outputs. */
export const UniverseSchema = z
  .object({
    id: z.string().min(1),
    name: EntityName,
    order: z.string().min(1).default(DEFAULT_ORDER_KEY),
  })
  .strict();
export type Universe = Entity<typeof UniverseSchema, UniverseId>;

export const OUTPUT_KINDS = [
  "enttec-open-dmx",
  "enttec-usb-pro",
  "anyma-udmx",
] as const;
export type OutputKind = (typeof OUTPUT_KINDS)[number];
export const OUTPUT_LABELS: Record<OutputKind, string> = {
  "enttec-open-dmx": "Enttec Open DMX USB",
  "enttec-usb-pro": "Enttec DMX USB Pro",
  "anyma-udmx": "Anyma uDMX",
};

/** Any device: the first one of the Output's kind found. */
export const ANY_DEVICE = "any";

/**
 * One delivery of one Universe to the world through a USB widget. A serial
 * widget is named by its serial number or path, a uDMX by its serial number
 * or USB port location, and either by `any` for the first one found;
 * whether it is delivering is live state, never here.
 */
export const OutputSchema = z
  .object({
    id: z.string().min(1),
    universeId: z.string().min(1),
    kind: z.enum(OUTPUT_KINDS),
    device: z.string().trim().min(1).default(ANY_DEVICE),
  })
  .strict();
export type Output = Entity<typeof OutputSchema, OutputId>;

/** A Fixture Type copied into the Installation, keyed by its library key. */
export const StoredFixtureTypeSchema = z
  .object({ id: z.string().min(1), type: FixtureTypeSchema })
  .strict();
export type StoredFixtureType = Entity<
  typeof StoredFixtureTypeSchema,
  FixtureTypeId
>;

export const PatchSchema = z
  .object({
    universeId: z.string().min(1),
    address: z.number().int().min(1).max(512),
  })
  .strict();
export type FixturePatch = z.infer<typeof PatchSchema>;

/** Stage space: metres, origin centre stage on the floor, `y` up, `z` toward the audience; rotations in degrees. */
export const PositionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    rx: z.number(),
    ry: z.number(),
    rz: z.number(),
  })
  .strict();
export type Position = z.infer<typeof PositionSchema>;
export const ORIGIN: Position = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };

/** A Tag a person adds: the shape Modes declare theirs in. */
export const PersonTagSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "must be lowercase letters, digits and dashes",
  );

const FixtureBase = {
  id: z.string().min(1),
  name: EntityName,
  /** The Group containing the row, or null at the section's root. Never a Fixture. */
  parentId: z.string().min(1).nullable(),
  order: z.string().min(1).default(DEFAULT_ORDER_KEY),
};

export const FIXTURE_KINDS = ["fixture", "group"] as const;
export type FixtureKind = (typeof FIXTURE_KINDS)[number];
export const FIXTURE_LABELS: Record<FixtureKind, string> = {
  fixture: "Fixture",
  group: "Group",
};

/**
 * One device in the Rig: its type and Mode (the type is copied into
 * `fixtureTypes`), its Patch or none, its Position, and the Tags a person
 * added: `tags` on the Fixture itself, which is the root Element of the tree
 * its Mode declares, and `elementTags` by key on the Elements below it.
 */
export const FixtureSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...FixtureBase,
      kind: z.literal("fixture"),
      typeKey: z.string().min(1),
      modeKey: z.string().min(1),
      patch: PatchSchema.nullable(),
      position: PositionSchema,
      tags: z.array(PersonTagSchema).default([]),
      elementTags: z
        .record(z.string().min(1), z.array(PersonTagSchema))
        .default({}),
    })
    .strict(),
  z.object({ ...FixtureBase, kind: z.literal("group") }).strict(),
]);
export type Fixture = Entity<typeof FixtureSchema, FixtureId>;
export type PatchedFixture = Extract<Fixture, { kind: "fixture" }>;
