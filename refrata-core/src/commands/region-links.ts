import { attributeOwners } from "../composition/contributions.ts";
import { regionAimValue } from "../composition/region-values.ts";
import type { VisualLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import type { PresetRow } from "../document/preset.ts";
import {
  parseRegionPlace,
  REGION_AIM_LABELS,
  REGION_FORM_LABELS,
  regionAim,
  type Region,
  type RegionPlace,
} from "../document/region.ts";
import { targetElements } from "../document/targets.ts";
import { elementRef } from "../rig/elements.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import { notLayerOf } from "./kind-problems.ts";

/** One axis of an Aim of a Layer's Region, as a Preset Link names it. */
export interface NamedPlace extends RegionPlace {
  readonly layer: VisualLayer;
  readonly region: Region;
}

/**
 * The place of a Region `address` names, why a Preset cannot drive it, or
 * undefined when `address` names no place at all. The Layer must have a
 * Region with that Aim, and must not be on the Blend Mode `add`, where the
 * Region is an offset and a Preset holds places.
 */
export function namedPlace(
  document: Document,
  address: string,
): NamedPlace | { readonly error: string } | undefined {
  const place = parseRegionPlace(address);
  if (place === undefined) return undefined;
  const layer = document.layers[place.layerId];
  if (layer?.kind !== "visual")
    return { error: notLayerOf(document, place.layerId, "visual") };
  const region = layer.region;
  if (
    region === undefined ||
    visualDefinition(layer.visual)?.region === undefined
  )
    return { error: `“${layer.name}” has no Region.` };
  if (regionAim(region, place.aim) === undefined)
    return {
      error: `The Region of “${layer.name}” is by ${REGION_FORM_LABELS[region.form].toLowerCase()}; it has no ${REGION_AIM_LABELS[place.aim]}.`,
    };
  if (layer.blendMode === "add")
    return {
      error: `On Add the Region of “${layer.name}” is an offset from what is below, and a Preset holds places. Link the Look Layer below to the Preset instead.`,
    };
  return { ...place, layer, region };
}

/**
 * The Elements and rows a Preset takes from one place when it grows out of
 * it: every Element the Layer's Targets stand for that has the axis, each
 * holding what the Aim is for it now.
 */
export function seedFromPlace(
  document: Document,
  place: NamedPlace,
): ReadonlyMap<string, PresetRow> {
  const rows = new Map<string, PresetRow>();
  for (const target of place.layer.targets)
    for (const located of targetElements(document, target.ref))
      for (const owner of attributeOwners(located, place.axis)) {
        const ref = elementRef(located.fixture.id, owner.key);
        if (rows.has(ref)) continue;
        const value = regionAimValue(
          document,
          place.layer,
          place.region,
          place.aim,
          place.axis,
          {
            fixtureId: located.fixture.id,
            elements: located.elements,
            element: owner,
          },
        );
        if (value !== undefined) rows.set(ref, { value });
      }
  return rows;
}
