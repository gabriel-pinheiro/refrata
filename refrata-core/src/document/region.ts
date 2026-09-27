import { z } from "zod";

import type { BlendMode } from "./composition.ts";

/**
 * The Region of a Visual Layer running a movement Visual: the box in aim
 * space the Visual draws inside, the Frame's counterpart for `pan` and
 * `tilt`. It is written by corners, two Aims, or by center and size, one
 * Aim with a width and a height in degrees, and stored as written, so
 * editing stays in the form chosen. Set once per Layer like a Frame, never
 * an Address. Reasoned in docs/moving-heads-and-geometry.md.
 */
export const REGION_AXES = ["pan", "tilt"] as const;
export type RegionAxis = (typeof REGION_AXES)[number];

/** A typed Aim of a Region: one value for every Target, in degrees. */
export const RegionAimSchema = z
  .object({ pan: z.number(), tilt: z.number() })
  .strict();
export type RegionAim = z.infer<typeof RegionAimSchema>;

export const RegionSchema = z.discriminatedUnion("form", [
  z
    .object({
      form: z.literal("corners"),
      /** Where the Visual's 0 is on both axes. */
      from: RegionAimSchema,
      /** Where its 1 is; an axis may run backwards. */
      to: RegionAimSchema,
    })
    .strict(),
  z
    .object({
      form: z.literal("center"),
      center: RegionAimSchema,
      width: z.number().min(0),
      height: z.number().min(0),
    })
    .strict(),
]);
export type Region = z.infer<typeof RegionSchema>;
export type RegionForm = Region["form"];
export type CornersRegion = Extract<Region, { form: "corners" }>;
export type CenterRegion = Extract<Region, { form: "center" }>;

export const REGION_FORMS = ["corners", "center"] as const;
export const REGION_FORM_LABELS: Record<RegionForm, string> = {
  corners: "Corners",
  center: "Center and size",
};

/** The Aims a Region has, by the name a place and a command give them. */
export const REGION_AIMS = ["from", "to", "center"] as const;
export type RegionAimName = (typeof REGION_AIMS)[number];
export const REGION_AIM_LABELS: Record<RegionAimName, string> = {
  from: "From",
  to: "To",
  center: "Center",
};

/** The Aims of one form, in the order they are shown. */
export function regionAimNames(form: RegionForm): readonly RegionAimName[] {
  return form === "corners" ? ["from", "to"] : ["center"];
}

/** A typed Aim of a Region by name; undefined when its form has no such Aim. */
export function regionAim(
  region: Region,
  name: RegionAimName,
): RegionAim | undefined {
  if (region.form === "corners")
    return name === "from"
      ? region.from
      : name === "to"
        ? region.to
        : undefined;
  return name === "center" ? region.center : undefined;
}

/** How a Region's center reads: a place, or on the Blend Mode `add` an offset from what is below. */
export function regionAimLabel(
  name: RegionAimName,
  blendMode: BlendMode,
): string {
  return name === "center" && blendMode === "add"
    ? "Offset"
    : REGION_AIM_LABELS[name];
}

/** The same box by center and size; corners that ran backwards lose their direction. */
export function toCenterRegion(region: Region): CenterRegion {
  if (region.form === "center") return region;
  return {
    form: "center",
    center: {
      pan: (region.from.pan + region.to.pan) / 2,
      tilt: (region.from.tilt + region.to.tilt) / 2,
    },
    width: Math.abs(region.to.pan - region.from.pan),
    height: Math.abs(region.to.tilt - region.from.tilt),
  };
}

/** The same box by corners, `from` at the lower pan and tilt. */
export function toCornersRegion(region: Region): CornersRegion {
  if (region.form === "corners") return region;
  const { center, width, height } = region;
  return {
    form: "corners",
    from: { pan: center.pan - width / 2, tilt: center.tilt - height / 2 },
    to: { pan: center.pan + width / 2, tilt: center.tilt + height / 2 },
  };
}

export function toRegionForm(region: Region, form: RegionForm): Region {
  return form === "corners" ? toCornersRegion(region) : toCenterRegion(region);
}

/**
 * A Region as a Layer on `blendMode` may hold it: on `add` it is center and
 * size only, its center an offset, so corners become their center and size.
 */
export function regionForBlend(region: Region, blendMode: BlendMode): Region {
  return blendMode === "add" ? toCenterRegion(region) : region;
}

/**
 * A Region's Aim axis as a Link names it: `layer/<id>/region/<aim>/<axis>`.
 * It is a place, not an Address: nothing resolves, lists, sets or performs
 * it, and only a Preset Link may name it.
 */
export function regionPlace(
  layerId: string,
  aim: RegionAimName,
  axis: RegionAxis,
): string {
  return `layer/${layerId}/region/${aim}/${axis}`;
}

/** The prefix of every place of a Layer's Region. */
export function regionPlacePrefix(layerId: string): string {
  return `layer/${layerId}/region/`;
}

export interface RegionPlace {
  readonly layerId: string;
  readonly aim: RegionAimName;
  readonly axis: RegionAxis;
}

/** The place a string names, or undefined when it is not one. */
export function parseRegionPlace(text: string): RegionPlace | undefined {
  const [layer, layerId, region, aim, axis, ...rest] = text.split("/");
  if (layer !== "layer" || region !== "region" || rest.length > 0)
    return undefined;
  if (layerId === undefined || layerId === "") return undefined;
  if (!REGION_AIMS.includes(aim as RegionAimName)) return undefined;
  if (!REGION_AXES.includes(axis as RegionAxis)) return undefined;
  return { layerId, aim: aim as RegionAimName, axis: axis as RegionAxis };
}
