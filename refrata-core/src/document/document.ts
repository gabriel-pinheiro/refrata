import { z, type ZodType } from "zod";

import {
  generateId,
  type Id,
  type ControllerId,
  type InstallationId,
  type LinkId,
  type MacroId,
} from "../ids.ts";
import { ColorSchema } from "../parameters.ts";
import { DEFAULT_ORDER_KEY } from "./order.ts";
import {
  FixtureSchema,
  OutputSchema,
  StoredFixtureTypeSchema,
  UniverseSchema,
  type Fixture,
  type Output,
  type StoredFixtureType,
  type Universe,
} from "./rig.ts";

/**
 * A Document is one Installation as normalized entity tables. Every table is
 * keyed by entity id; order, where it matters, is an explicit field on the
 * entity. Patches address any value by path (`["controllers", id, "name"]`),
 * so deltas on the wire are per property, never per Installation.
 *
 * `operational` holds live state (Blackout) that is replicated like everything
 * else but never written to the file.
 */

const EntityName = z.string().trim().min(1).max(120);

/**
 * The TypeScript type of an entity: its Zod schema's output with the `id`
 * narrowed to the entity's branded id. Schemas keep `id` as a plain string
 * because ids arrive from files and the wire as text.
 */
export type Entity<TSchema extends ZodType, TId extends Id<string>> = Branded<
  z.infer<TSchema>,
  TId
>;
/** Distributes over unions, so a discriminated entity keeps its variants. */
type Branded<TValue, TId> = TValue extends unknown
  ? Omit<TValue, "id"> & { readonly id: TId }
  : never;

export const InstallationSchema = z
  .object({
    id: z.string().min(1),
    name: EntityName,
  })
  .strict();
export type Installation = Entity<typeof InstallationSchema, InstallationId>;

/** Fields every Controller has, whatever its kind. */
const ControllerBase = {
  id: z.string().min(1),
  name: EntityName,
  /** The Group containing the Controller, or null at the section's root. */
  parentId: z.string().min(1).nullable(),
  /** Position among the Controllers of the same parent. */
  order: z.string().min(1).default(DEFAULT_ORDER_KEY),
};

export const CONTROLLER_KINDS = ["number", "color", "group"] as const;
export type ControllerKind = (typeof CONTROLLER_KINDS)[number];

/**
 * A Controller is one Installation-wide value that Parameter Links spread
 * over many Addresses: a Number Controller holds 0 to 1, a Color Controller
 * a color. Its value is part of the file, so a Color Controller doubles as a
 * saved palette entry. A Group only arranges Controllers in the navigator.
 */
export const ControllerSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...ControllerBase,
      kind: z.literal("number"),
      value: z.number().min(0).max(1),
    })
    .strict(),
  z
    .object({ ...ControllerBase, kind: z.literal("color"), value: ColorSchema })
    .strict(),
  z.object({ ...ControllerBase, kind: z.literal("group") }).strict(),
]);
export type Controller = Entity<typeof ControllerSchema, ControllerId>;
export type NumberController = Extract<Controller, { kind: "number" }>;
export type ColorController = Extract<Controller, { kind: "color" }>;

/**
 * A Parameter Link makes a Controller drive one Address. A number link maps
 * the Controller's 0 and 1 onto `from` and `to` in the target's units,
 * linearly, reversed when `from` is the larger; a color link copies the
 * color. An Address has at most one Link, and the value authored under it
 * stays in the document, dormant until the Link goes.
 */
export const LinkSchema = z
  .object({
    id: z.string().min(1),
    controllerId: z.string().min(1),
    address: z.string().min(1),
    /** Target values at Controller 0 and 1; null for color links. */
    anchors: z.object({ from: z.number(), to: z.number() }).strict().nullable(),
  })
  .strict();
export type Link = Entity<typeof LinkSchema, LinkId>;
export type LinkAnchors = NonNullable<Link["anchors"]>;

/** Fields every Macro has, whatever its kind. */
const MacroBase = {
  id: z.string().min(1),
  name: EntityName,
  /** The Group containing the Macro, or null at the section's root. */
  parentId: z.string().min(1).nullable(),
  /** Position among the Macros of the same parent. */
  order: z.string().min(1).default(DEFAULT_ORDER_KEY),
};

export const MACRO_KINDS = ["macro", "group"] as const;
export type MacroKind = (typeof MACRO_KINDS)[number];

/** What an Address can hold: a number, a switch, a choice's value or a color. */
export const AddressValueSchema = z.union([
  z.number(),
  z.boolean(),
  z.string(),
  ColorSchema,
]);

/**
 * One step of a Macro, on one Address: `set` writes a value, `toggle` flips
 * a boolean, `trigger` fires a trigger Address such as another Macro's run.
 */
export const MacroActionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("set"),
      address: z.string().min(1),
      value: AddressValueSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("toggle"),
      address: z.string().min(1),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("trigger"),
      address: z.string().min(1),
    })
    .strict(),
]);
/** Action ids are plain strings: unique within their Macro, never a table key. */
export type MacroAction = z.infer<typeof MacroActionSchema>;
export type MacroActionKind = MacroAction["kind"];

/**
 * A Macro is a named, ordered list of actions run as one performance step
 * from its trigger Address `macro/<id>/run`: a look, a hit, a state. A Group
 * only arranges Macros in the navigator.
 */
export const MacroSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...MacroBase,
      kind: z.literal("macro"),
      actions: z.array(MacroActionSchema),
    })
    .strict(),
  z.object({ ...MacroBase, kind: z.literal("group") }).strict(),
]);
export type Macro = Entity<typeof MacroSchema, MacroId>;
export type RunnableMacro = Extract<Macro, { kind: "macro" }>;

export const OperationalSchema = z
  .object({
    blackout: z.boolean(),
    /** Held highlights by Element reference (`<fixtureId>/<key>`); true while held. */
    highlight: z.record(z.string(), z.boolean()),
  })
  .strict();
export type Operational = z.infer<typeof OperationalSchema>;

export type Table<TEntity extends { readonly id: string }> = Readonly<
  Record<string, TEntity>
>;

export const DocumentSchema = z
  .object({
    installation: InstallationSchema,
    universes: z.record(z.string(), UniverseSchema),
    outputs: z.record(z.string(), OutputSchema),
    fixtureTypes: z.record(z.string(), StoredFixtureTypeSchema),
    fixtures: z.record(z.string(), FixtureSchema),
    controllers: z.record(z.string(), ControllerSchema),
    links: z.record(z.string(), LinkSchema),
    macros: z.record(z.string(), MacroSchema),
    operational: OperationalSchema,
  })
  .strict();

export interface Document {
  readonly installation: Installation;
  readonly universes: Table<Universe>;
  readonly outputs: Table<Output>;
  readonly fixtureTypes: Table<StoredFixtureType>;
  readonly fixtures: Table<Fixture>;
  readonly controllers: Table<Controller>;
  readonly links: Table<Link>;
  readonly macros: Table<Macro>;
  readonly operational: Operational;
}

/** Entity table schemas, keyed by the table's name in the Document. */
export const TABLE_SCHEMAS = {
  universes: UniverseSchema,
  outputs: OutputSchema,
  fixtureTypes: StoredFixtureTypeSchema,
  fixtures: FixtureSchema,
  controllers: ControllerSchema,
  links: LinkSchema,
  macros: MacroSchema,
} as const;
export type TableName = keyof typeof TABLE_SCHEMAS;

/** Tables whose entities carry an `order` key and can be rearranged. */
export const ORDERED_TABLES = [
  "universes",
  "fixtures",
  "controllers",
  "macros",
] as const satisfies readonly TableName[];
export type OrderedTableName = (typeof ORDERED_TABLES)[number];

/**
 * Ordered tables whose entities are children: siblings share the values of
 * these fields, and order keys and names are unique only among siblings.
 */
export const PARENT_FIELDS: Partial<
  Record<OrderedTableName, readonly string[]>
> = {
  fixtures: ["parentId"],
  controllers: ["parentId"],
  macros: ["parentId"],
};

/** The entities of `table` that share `entity`'s parent, `entity` included. */
export function siblingsOf<TEntity extends { readonly id: string }>(
  tableName: OrderedTableName,
  table: Table<TEntity>,
  entity: TEntity,
): Table<TEntity> {
  const fields = PARENT_FIELDS[tableName];
  if (fields === undefined) return table;
  const record = entity as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(table).filter(([, candidate]) =>
      fields.every(
        (field) =>
          (candidate as Record<string, unknown>)[field] === record[field],
      ),
    ),
  );
}

export const defaultOperational: Operational = {
  blackout: false,
  highlight: {},
};

/** The name of the Universe every new Installation starts with. */
export const FIRST_UNIVERSE_NAME = "Universe 1";

/** A new Installation has one Universe, so adding a Fixture needs no setup step. */
export function emptyDocument(name: string): Document {
  const universeId = generateId("universe");
  return {
    installation: { id: generateId("installation"), name },
    universes: {
      [universeId]: {
        id: universeId,
        name: FIRST_UNIVERSE_NAME,
        order: DEFAULT_ORDER_KEY,
      },
    },
    outputs: {},
    fixtureTypes: {},
    fixtures: {},
    controllers: {},
    links: {},
    macros: {},
    operational: defaultOperational,
  };
}

export function tableEntries<TEntity extends { readonly id: string }>(
  table: Table<TEntity>,
): readonly TEntity[] {
  return Object.values(table);
}
