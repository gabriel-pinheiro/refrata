import { effectiveAt, linkAt, presetOfLink } from "../address/links.ts";
import type { VisualLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import {
  REGION_AXES,
  regionAim,
  regionPlace,
  type Region,
  type RegionAimName,
  type RegionAxis,
} from "../document/region.ts";
import { paramAddress } from "../document/visual-layers.ts";
import type { Element } from "../rig/elements.ts";
import type { RegionDefinition } from "../visuals/sdk.ts";
import { presetValueFor } from "./preset-values.ts";

/** One Element in its Fixture: what a Preset is asked about. */
export interface RegionElement {
  readonly fixtureId: string;
  readonly elements: readonly Element[];
  readonly element: Element;
}

/**
 * What one axis of a Region's Aim is for one Element, in degrees: the
 * Preset's value for that Element when the axis is linked to one, the typed
 * value otherwise. Undefined when the Preset has nothing for the Element,
 * or the Region's form has no such Aim.
 */
export function regionAimValue(
  document: Document,
  layer: VisualLayer,
  region: Region,
  aim: RegionAimName,
  axis: RegionAxis,
  at: RegionElement,
): number | undefined {
  const typed = regionAim(region, aim)?.[axis];
  if (typed === undefined) return undefined;
  const link = linkAt(document, regionPlace(layer.id, aim, axis));
  const preset = link === undefined ? undefined : presetOfLink(document, link);
  if (preset === undefined) return typed;
  const value = presetValueFor(
    document,
    preset,
    at.fixtureId,
    at.elements,
    at.element,
    axis,
  );
  return typeof value === "number" ? value : undefined;
}

/** A Region for one Element: where each axis is at the Visual's 0 and at its 1, in degrees. */
export type RegionBox = Readonly<
  Record<RegionAxis, { readonly from: number; readonly to: number }>
>;

/**
 * The box a Region is for one Element, or undefined when a Preset one of
 * its Aims is linked to has nothing for the Element, which is then
 * released.
 */
export function regionBox(
  document: Document,
  layer: VisualLayer,
  region: Region,
  at: RegionElement,
): RegionBox | undefined {
  const ends: Partial<Record<RegionAxis, { from: number; to: number }>> = {};
  for (const axis of REGION_AXES) {
    if (region.form === "corners") {
      const from = regionAimValue(document, layer, region, "from", axis, at);
      const to = regionAimValue(document, layer, region, "to", axis, at);
      if (from === undefined || to === undefined) return undefined;
      ends[axis] = { from, to };
      continue;
    }
    const center = regionAimValue(document, layer, region, "center", axis, at);
    if (center === undefined) return undefined;
    const half = (axis === "pan" ? region.width : region.height) / 2;
    ends[axis] = { from: center - half, to: center + half };
  }
  const { pan, tilt } = ends;
  return pan === undefined || tilt === undefined ? undefined : { pan, tilt };
}

/** The Layer's turn of what its Visual draws, in radians: the Parameter its Region declaration names, as the show sees it. */
export function regionTurn(
  document: Document,
  layer: VisualLayer,
  definition: RegionDefinition,
): number {
  if (definition.rotation === undefined) return 0;
  const degrees = effectiveAt(
    document,
    paramAddress(layer.id, definition.rotation),
    layer.parameters[definition.rotation],
  );
  return typeof degrees === "number" ? (degrees * Math.PI) / 180 : 0;
}

/**
 * Where the fractions a Visual wrote along the width and the height land
 * in a box, in degrees: measured from the box's center, turned by `turn`
 * in aim space, and set back on the center. With `sizeOnly` the center is
 * left out, which is what corners give on the Blend Mode `add`: they are
 * places, and an offset takes their size alone.
 */
export function mapIntoBox(
  box: RegionBox,
  fractions: { readonly width: number; readonly height: number },
  turn: number,
  sizeOnly = false,
): Readonly<Record<RegionAxis, number>> {
  const x = (fractions.width - 0.5) * (box.pan.to - box.pan.from);
  const y = (fractions.height - 0.5) * (box.tilt.to - box.tilt.from);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const center = sizeOnly
    ? { pan: 0, tilt: 0 }
    : {
        pan: (box.pan.from + box.pan.to) / 2,
        tilt: (box.tilt.from + box.tilt.to) / 2,
      };
  return {
    pan: center.pan + x * cos - y * sin,
    tilt: center.tilt + x * sin + y * cos,
  };
}
