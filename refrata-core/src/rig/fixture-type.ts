import { z } from "zod";

import { ParameterValueSchema } from "../parameters.ts";
import { ATTRIBUTES, isAttributeKey } from "./attributes.ts";

/**
 * The Fixture Type file: the project's own JSON format, the form every
 * importer targets. A Mode declares its Channel Layout (flat, wire order,
 * each Channel naming its Element), its Element tree (keyed, `root` at the
 * top), each Element's Parameters and how they encode into Channels, and a
 * Shape Template for the Rig View. Nothing here holds a value; an
 * Installation does.
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

/**
 * How a Parameter reaches Channels. `scale` writes a number across one
 * Channel's bytes; `color` writes a color to red, green and blue Channels and
 * an optional fourth white Channel (white extracted as the minimum and
 * subtracted from the three); `multiply` scales the bytes of other Channels
 * by a number that has no Channel of its own (a virtual dimmer).
 */
export const EncodeSchema = z.union([
  z.object({ scale: ChannelKey }).strict(),
  z.object({ color: z.array(ChannelKey).min(3).max(4) }).strict(),
  z.object({ multiply: z.array(ChannelKey).min(1) }).strict(),
]);
export type Encode = z.infer<typeof EncodeSchema>;

export const ParameterDeclarationSchema = z
  .object({
    default: ParameterValueSchema.optional(),
    highlight: ParameterValueSchema.optional(),
    /** Physical range overrides for a number Attribute. */
    min: z.number().optional(),
    max: z.number().optional(),
    unit: z.string().optional(),
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

/** Every reference a Mode makes must land: Channels on Elements, Encoding on Channels of the same Element, the tree on `root`. */
function modeProblems(mode: Mode): string[] {
  const problems: string[] = [];
  const channelKeys = new Set<string>();
  for (const channel of mode.channels) {
    if (channelKeys.has(channel.key))
      problems.push(`Channel “${channel.key}” is declared twice`);
    channelKeys.add(channel.key);
    if (!(channel.element in mode.elements))
      problems.push(
        `Channel “${channel.key}” names unknown Element “${channel.element}”`,
      );
  }
  if (!(ROOT_ELEMENT_KEY in mode.elements))
    problems.push(`Element “${ROOT_ELEMENT_KEY}” is missing`);
  const parents = new Map<string, string>();
  for (const [key, element] of Object.entries(mode.elements)) {
    for (const child of element.children) {
      if (!(child in mode.elements))
        problems.push(`Element “${key}” lists unknown child “${child}”`);
      else if (child === ROOT_ELEMENT_KEY)
        problems.push(`Element “${ROOT_ELEMENT_KEY}” cannot be a child`);
      else if (parents.has(child))
        problems.push(`Element “${child}” has two parents`);
      else parents.set(child, key);
    }
    for (const [attribute, parameter] of Object.entries(element.parameters)) {
      if (!isAttributeKey(attribute)) {
        problems.push(
          `Element “${key}” declares unknown Attribute “${attribute}”`,
        );
        continue;
      }
      const kind = ATTRIBUTES[attribute].kind;
      const encoded =
        "scale" in parameter.encode
          ? [parameter.encode.scale]
          : "color" in parameter.encode
            ? parameter.encode.color
            : parameter.encode.multiply;
      if ("color" in parameter.encode && kind !== "color")
        problems.push(
          `“${attribute}” of “${key}” is not a color and cannot encode as one`,
        );
      if (!("color" in parameter.encode) && kind !== "number")
        problems.push(
          `“${attribute}” of “${key}” is not a number and cannot scale or multiply`,
        );
      for (const channelKey of encoded) {
        const channel = mode.channels.find(
          (candidate) => candidate.key === channelKey,
        );
        if (channel === undefined)
          problems.push(
            `“${attribute}” of “${key}” encodes into unknown Channel “${channelKey}”`,
          );
        else if (channel.element !== key)
          problems.push(
            `“${attribute}” of “${key}” encodes into Channel “${channelKey}” of another Element`,
          );
      }
    }
  }
  for (const key of Object.keys(mode.elements)) {
    if (key !== ROOT_ELEMENT_KEY && !parents.has(key))
      problems.push(
        `Element “${key}” is not reachable from “${ROOT_ELEMENT_KEY}”`,
      );
  }
  return problems;
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
