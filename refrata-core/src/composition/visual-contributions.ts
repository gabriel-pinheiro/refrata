import type { VisualLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import type { Region } from "../document/region.ts";
import type { ExpandedTarget } from "../document/targets.ts";
import { visualTargets } from "../document/visual-layers.ts";
import type { Color } from "../parameters.ts";
import { ATTRIBUTES, isAttributeKey } from "../rig/attributes.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import type { RegionDefinition } from "../visuals/sdk.ts";
import {
  landContribution,
  type Candidate,
  type Contributions,
} from "./contributions.ts";
import type { AttributeKey } from "../rig/attributes.ts";
import { mapIntoBox, regionBox, regionTurn } from "./region-values.ts";

/** What one Slot wrote for one Target this frame. */
export interface SlotOutput {
  readonly value: number | Color;
  readonly alpha: number;
}

/** One Visual Layer's frame: by Slot key, then by Target key. */
export type VisualOutput = ReadonlyMap<string, ReadonlyMap<string, SlotOutput>>;

/** Every Visual Layer's frame by Layer id, as the player hands it to Resolve. */
export type VisualOutputs = ReadonlyMap<string, VisualOutput>;

type Best = Map<string, Map<AttributeKey, Candidate>>;

/**
 * What a Visual Layer contributes this frame given what its Visual wrote:
 * each bound Slot's value goes through its binding (a number from 0 to 1
 * onto the anchors) and lands on its Target's Elements exactly as a Look
 * Layer row does. A Slot bound to nothing, and a Target the Visual wrote
 * nothing for, contribute nothing. On a Layer with a Region, the Slots its
 * Visual runs along the Region go through the Region instead, onto `pan`
 * and `tilt`, Element by Element.
 */
export function visualContributions(
  document: Document,
  layer: VisualLayer,
  output: VisualOutput | undefined,
): Contributions {
  const best: Best = new Map();
  if (output === undefined) return best;
  const { expanded } = visualTargets(document, layer);
  const declared = visualDefinition(layer.visual)?.region;
  const region = declared === undefined ? undefined : layer.region;
  if (declared !== undefined && region !== undefined)
    landRegion(best, document, layer, region, declared, output, expanded);
  const bound =
    declared !== undefined && region === undefined
      ? turned(output, declared, regionTurn(document, layer, declared))
      : output;
  for (const [slot, byTarget] of bound) {
    if (
      region !== undefined &&
      (slot === declared?.width || slot === declared?.height)
    )
      continue;
    const binding = layer.bindings[slot];
    const attribute = binding?.attribute;
    if (attribute === null || attribute === undefined) continue;
    if (!isAttributeKey(attribute)) continue;
    const definition = ATTRIBUTES[attribute];
    expanded.forEach((target, index) => {
      const written = byTarget.get(target.ref);
      if (written === undefined || written.alpha <= 0) return;
      let value = written.value;
      if (typeof value === "number") {
        if (definition.kind !== "number") return;
        const from = binding?.from ?? definition.min;
        const to = binding?.to ?? definition.max;
        value = from + (to - from) * value;
      } else if (definition.kind !== "color") return;
      for (const located of target.elements)
        landContribution(
          best,
          located,
          attribute,
          { value, alpha: Math.min(1, written.alpha) },
          index,
        );
    });
  }
  return best;
}

/**
 * What the Visual wrote with its two Region Slots turned about their
 * middle, for a Layer that has no Region and sends them through their
 * bindings: the turn is in the Slots' own 0 to 1, before the anchors.
 */
function turned(
  output: VisualOutput,
  declared: RegionDefinition,
  turn: number,
): VisualOutput {
  const width = output.get(declared.width);
  const height = output.get(declared.height);
  if (turn === 0 || declared.width === declared.height) return output;
  if (width === undefined || height === undefined) return output;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const x = new Map<string, SlotOutput>();
  const y = new Map<string, SlotOutput>();
  for (const [key, along] of width) {
    const up = height.get(key);
    if (typeof along.value !== "number" || typeof up?.value !== "number")
      continue;
    const dx = along.value - 0.5;
    const dy = up.value - 0.5;
    x.set(key, { value: 0.5 + dx * cos - dy * sin, alpha: along.alpha });
    y.set(key, { value: 0.5 + dx * sin + dy * cos, alpha: up.alpha });
  }
  return new Map(output).set(declared.width, x).set(declared.height, y);
}

/**
 * Lands what the Visual wrote along the Region on `pan` and `tilt`. Each
 * Element is asked for its own box, since an Aim linked to a Preset differs
 * per Element, and one the Preset has nothing for is released. An axis the
 * Visual wrote nothing on for a Target is released there, and counts as
 * the middle of the box for the turn of the other.
 */
function landRegion(
  best: Best,
  document: Document,
  layer: VisualLayer,
  region: Region,
  declared: RegionDefinition,
  output: VisualOutput,
  expanded: readonly ExpandedTarget[],
): void {
  const turn = regionTurn(document, layer, declared);
  const sizeOnly = layer.blendMode === "add" && region.form === "corners";
  const slots = {
    pan: output.get(declared.width),
    tilt: output.get(declared.height),
  };
  expanded.forEach((target, index) => {
    const written = {
      pan: slots.pan?.get(target.ref),
      tilt: slots.tilt?.get(target.ref),
    };
    const fraction = (slot: SlotOutput | undefined): number =>
      typeof slot?.value === "number" ? slot.value : 0.5;
    const fractions = {
      width: fraction(written.pan),
      height: fraction(written.tilt),
    };
    for (const axis of ["pan", "tilt"] as const) {
      const slot = written[axis];
      if (slot === undefined || slot.alpha <= 0) continue;
      if (typeof slot.value !== "number") continue;
      const alpha = Math.min(1, slot.alpha);
      for (const located of target.elements)
        landContribution(
          best,
          located,
          axis,
          (owner) => {
            const box = regionBox(document, layer, region, {
              fixtureId: located.fixture.id,
              elements: located.elements,
              element: owner,
            });
            return box === undefined
              ? undefined
              : {
                  value: mapIntoBox(box, fractions, turn, sizeOnly)[axis],
                  alpha,
                };
          },
          index,
        );
    }
  });
}
