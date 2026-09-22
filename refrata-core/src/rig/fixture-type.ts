import { z } from "zod";

import { ParameterValueSchema } from "../parameters.ts";
import { ByteRangeSchema, EncodeSchema } from "./encode-rules.ts";
import { modeProblems } from "./fixture-type-problems.ts";

export {
  EncodeSchema,
  ByteRangeSchema,
  encodedChannels,
} from "./encode-rules.ts";
export type { Encode, ByteRange } from "./encode-rules.ts";

/**
 * The Fixture Type file: the project's own JSON format, the form every
 * importer targets. A Mode declares its Channel Layout (flat, wire order,
 * each Channel naming its Element), its Element tree (keyed, `root` at the
 * top), each Element's Parameters and how they encode into Channels, its
 * Actions, and a Shape Template for the Rig View. Nothing here holds a
 * value; an Installation does.
 */
export const FIXTURE_TYPE_FILE_KIND = "refrata-fixture-type";
export const FIXTURE_TYPE_FORMAT_VERSION = 1;
export const ROOT_ELEMENT_KEY = "root";

const Key = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "must be lowercase letters, digits and dashes",
  );
const ChannelKey = Key;
const ElementKey = Key;
/** A library key such as `generic/rgb-3ch`: manufacturer slash model. */
export const FixtureTypeKeySchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/,
    "must look like manufacturer/model",
  );

/** One option of an open choice, with the bytes that select it. */
export const DeclaredOptionSchema = z
  .object({
    value: Key,
    label: z.string().trim().min(1),
    bytes: ByteRangeSchema,
  })
  .strict();
export type DeclaredOption = z.infer<typeof DeclaredOptionSchema>;

const Rgb = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
]);

/** One slot of a colour wheel: the colour it shows and the bytes that select it. */
export const SwatchSchema = z
  .object({
    label: z.string().trim().min(1),
    color: Rgb,
    bytes: ByteRangeSchema,
  })
  .strict();
export type Swatch = z.infer<typeof SwatchSchema>;

export const ParameterDeclarationSchema = z
  .object({
    default: ParameterValueSchema.optional(),
    highlight: ParameterValueSchema.optional(),
    /** Physical range overrides for a number Attribute. */
    min: z.number().optional(),
    max: z.number().optional(),
    unit: z.string().optional(),
    /** The options of an open choice Attribute, in wheel order. */
    options: z.array(DeclaredOptionSchema).min(1).optional(),
    /** The discrete gamut of a colour on a wheel, in wheel order. */
    swatches: z.array(SwatchSchema).min(1).optional(),
    encode: EncodeSchema,
    notes: z.string().optional(),
  })
  .strict();
export type ParameterDeclaration = z.infer<typeof ParameterDeclarationSchema>;

export const ElementDeclarationSchema = z
  .object({
    name: z.string().trim().min(1),
    children: z.array(ElementKey).default([]),
    tags: z.array(Key).default([]),
    parameters: z.record(z.string(), ParameterDeclarationSchema).default({}),
  })
  .strict();
export type ElementDeclaration = z.infer<typeof ElementDeclarationSchema>;

export const ChannelSchema = z
  .object({
    key: ChannelKey,
    element: ElementKey,
    bytes: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
    /** The byte value the Channel rests at when nothing encodes into it. */
    default: z.number().int().min(0).max(255).default(0),
  })
  .strict();
export type Channel = z.infer<typeof ChannelSchema>;

/**
 * An Action: a byte a Mode holds on one Channel for a time, for what a
 * fixture does on command rather than in a look (a reset, a lamp strike).
 * The Runtime writes it over the encoded frame while it runs and drops it
 * when `seconds` are up.
 */
export const ActionSchema = z
  .object({
    name: z.string().trim().min(1),
    channel: ChannelKey,
    byte: z.number().int().min(0).max(255),
    seconds: z.number().positive(),
  })
  .strict();
export type Action = z.infer<typeof ActionSchema>;

export const ShapeSchema = z.discriminatedUnion("template", [
  z.object({ template: z.literal("single") }).strict(),
  z
    .object({
      template: z.literal("bar"),
      tag: Key,
      count: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      template: z.literal("grid"),
      tag: Key,
      cols: z.number().int().min(1),
      rows: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      template: z.literal("strobe-backlight"),
      sections: z.number().int().min(1),
      panels: z.number().int().min(1),
    })
    .strict(),
]);
export type Shape = z.infer<typeof ShapeSchema>;

export const ModeSchema = z
  .object({
    name: z.string().trim().min(1),
    channels: z.array(ChannelSchema).min(1),
    shape: ShapeSchema.default({ template: "single" }),
    elements: z.record(ElementKey, ElementDeclarationSchema),
    actions: z.record(Key, ActionSchema).default({}),
    notes: z.string().optional(),
  })
  .strict();
export type Mode = z.infer<typeof ModeSchema>;

export const FixtureTypeSchema = z
  .object({
    kind: z.literal(FIXTURE_TYPE_FILE_KIND),
    formatVersion: z.literal(FIXTURE_TYPE_FORMAT_VERSION),
    key: FixtureTypeKeySchema,
    manufacturer: z.string().trim().min(1),
    model: z.string().trim().min(1),
    notes: z.string().optional(),
    modes: z.record(Key, ModeSchema),
  })
  .strict()
  .superRefine((type, context) => {
    for (const [modeKey, mode] of Object.entries(type.modes)) {
      for (const problem of modeProblems(mode))
        context.addIssue({
          code: "custom",
          path: ["modes", modeKey],
          message: problem,
        });
    }
    if (Object.keys(type.modes).length === 0)
      context.addIssue({
        code: "custom",
        path: ["modes"],
        message: "needs at least one Mode",
      });
  });
export type FixtureType = z.infer<typeof FixtureTypeSchema>;

/** The number of DMX Addresses a Mode occupies. */
export function footprintOf(mode: Mode): number {
  return mode.channels.reduce((total, channel) => total + channel.bytes, 0);
}

/** Where a Channel starts within the Mode's Footprint, and how wide it is; undefined for an unknown key. */
export function channelSlot(
  mode: Mode,
  key: string,
): { readonly offset: number; readonly width: number } | undefined {
  let offset = 0;
  for (const channel of mode.channels) {
    if (channel.key === key) return { offset, width: channel.bytes };
    offset += channel.bytes;
  }
  return undefined;
}

export type ParsedFixtureType =
  | { readonly ok: true; readonly type: FixtureType }
  | { readonly ok: false; readonly error: string };

export function parseFixtureType(json: unknown): ParsedFixtureType {
  const parsed = FixtureTypeSchema.safeParse(json);
  if (parsed.success) return { ok: true, type: parsed.data };
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    error:
      `Not a Refrata Fixture Type: ${issue?.path.join(".") ?? ""} ${issue?.message ?? ""}`.trim(),
  };
}
