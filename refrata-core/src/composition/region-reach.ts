import { linkAt, presetOfLink } from "../address/links.ts";
import type { VisualLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import type { ValuePreset } from "../document/preset.ts";
import {
  REGION_AXES,
  regionPlace,
  type Region,
  type RegionAimName,
  type RegionAxis,
} from "../document/region.ts";
import { targetElements, targetLabel } from "../document/targets.ts";
import type { NumberBounds } from "../parameters.ts";
import { ATTRIBUTES } from "../rig/attributes.ts";
import { elementRef } from "../rig/elements.ts";
import { attributeOwners } from "./contributions.ts";
import { presetTargetValues, type PresetEntry } from "./preset-entries.ts";
import { regionBox } from "./region-values.ts";
import { reachLimits, reachOf, type ReachedRange } from "./row-reach.ts";

/** The Elements a Region's axis is measured against: every Element the Layer's Targets stand for that has the Parameter, with its own range. */
export function regionReach(
  document: Document,
  layer: VisualLayer,
  axis: RegionAxis,
): readonly ReachedRange[] {
  return reachOf(
    document,
    layer.targets.map((target) => target.ref),
    axis,
  );
}

/** The whole range the vocabulary gives an axis, and so the most a width or a height can be. */
export function axisBounds(axis: RegionAxis): NumberBounds {
  const { min, max } = ATTRIBUTES[axis];
  return { min, max };
}

/**
 * The limits a Region's typed Aim is held within on one axis: the widest
 * range the reached Elements cover together, as a Look Layer's Aim. On the
 * Blend Mode `add` the Aim is an offset, not a place, and takes the
 * vocabulary's whole range.
 */
export function regionLimits(
  document: Document,
  layer: VisualLayer,
  axis: RegionAxis,
): NumberBounds {
  const bounds = axisBounds(axis);
  return layer.blendMode === "add"
    ? bounds
    : reachLimits(regionReach(document, layer, axis), bounds);
}

/** The Preset one axis of a Region's Aim is linked to, if any. */
export function regionPreset(
  document: Document,
  layerId: string,
  aim: RegionAimName,
  axis: RegionAxis,
): ValuePreset | undefined {
  const link = linkAt(document, regionPlace(layerId, aim, axis));
  return link === undefined ? undefined : presetOfLink(document, link);
}

/** What each Element the Layer reaches takes from `preset` on one axis: what is listed under an Aim linked to it. */
export function regionPresetValues(
  document: Document,
  layer: VisualLayer,
  axis: RegionAxis,
  preset: ValuePreset,
): readonly PresetEntry[] {
  return presetTargetValues(
    document,
    layer.targets.map((target) => target.ref),
    axis,
    preset,
  );
}

/** One end of a Region an Element cannot go to. */
export interface RegionFlag {
  /** The Element reference. */
  readonly ref: string;
  readonly label: string;
  readonly axis: RegionAxis;
  /** The end of the box beyond the Element's range, in degrees. */
  readonly value: number;
  readonly min: number;
  readonly max: number;
}

/**
 * The ends of the Region each reached Element cannot go to, from its own
 * box: a corner, or the edge a center and size give. None on the Blend
 * Mode `add`, where the box is an offset from what is below.
 */
export function regionFlags(
  document: Document,
  layer: VisualLayer,
  region: Region,
): readonly RegionFlag[] {
  if (layer.blendMode === "add") return [];
  const flags: RegionFlag[] = [];
  const seen = new Set<string>();
  for (const target of layer.targets)
    for (const located of targetElements(document, target.ref))
      for (const axis of REGION_AXES)
        for (const owner of attributeOwners(located, axis)) {
          const ref = elementRef(located.fixture.id, owner.key);
          if (seen.has(`${ref} ${axis}`)) continue;
          seen.add(`${ref} ${axis}`);
          const definition = owner.parameters[axis]?.definition;
          if (definition?.kind !== "number") continue;
          const box = regionBox(document, layer, region, {
            fixtureId: located.fixture.id,
            elements: located.elements,
            element: owner,
          });
          if (box === undefined) continue;
          for (const value of new Set([box[axis].from, box[axis].to]))
            if (value < definition.min || value > definition.max)
              flags.push({
                ref,
                label: targetLabel(document, ref),
                axis,
                value,
                min: definition.min,
                max: definition.max,
              });
        }
  return flags;
}
