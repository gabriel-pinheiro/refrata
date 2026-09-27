import { z, type ZodType } from "zod";

import type { Id, LinkId } from "../ids.ts";

type Branded<TValue, TId> = TValue extends unknown
  ? Omit<TValue, "id"> & { readonly id: TId }
  : never;
type Entity<TSchema extends ZodType, TId extends Id<string>> = Branded<
  z.infer<TSchema>,
  TId
>;

const LinkBase = {
  id: z.string().min(1),
  address: z.string().min(1),
};

/**
 * A Parameter Link makes one source drive one Address; an Address has at
 * most one Link, and the value authored under it stays in the document,
 * dormant until the Link goes.
 *
 * From a Controller, a number link maps the Controller's 0 and 1 onto
 * `from` and `to` in the target's units, linearly, reversed when `from` is
 * the larger; a color link copies the color.
 *
 * From a Preset it has no anchors, since a Preset's values are already in
 * the Attribute's units, and it carries one value per Element: it drives
 * only what is resolved per Element, a Look Layer row.
 */
export const LinkSchema = z.union([
  z
    .object({
      ...LinkBase,
      controllerId: z.string().min(1),
      /** Target values at Controller 0 and 1; null for color links. */
      anchors: z
        .object({ from: z.number(), to: z.number() })
        .strict()
        .nullable(),
    })
    .strict(),
  z.object({ ...LinkBase, presetId: z.string().min(1) }).strict(),
]);
export type Link = Entity<typeof LinkSchema, LinkId>;
export type ControllerLink = Extract<Link, { readonly controllerId: string }>;
export type PresetLink = Extract<Link, { readonly presetId: string }>;
export type LinkAnchors = NonNullable<ControllerLink["anchors"]>;

export function isPresetLink(link: Link): link is PresetLink {
  return "presetId" in link;
}

export function isControllerLink(link: Link): link is ControllerLink {
  return "controllerId" in link;
}
