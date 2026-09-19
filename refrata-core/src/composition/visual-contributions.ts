import type { VisualLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import { visualTargets } from "../document/visual-layers.ts";
import type { Color } from "../parameters.ts";
import { ATTRIBUTES, isAttributeKey } from "../rig/attributes.ts";
import {
  landContribution,
  type Candidate,
  type Contributions,
} from "./contributions.ts";
import type { AttributeKey } from "../rig/attributes.ts";

/** What one Slot wrote for one Target this frame. */
export interface SlotOutput {
  readonly value: number | Color;
  readonly alpha: number;
}

/** One Visual Layer's frame: by Slot key, then by Target key. */
export type VisualOutput = ReadonlyMap<string, ReadonlyMap<string, SlotOutput>>;

/** Every Visual Layer's frame by Layer id, as the player hands it to Resolve. */
export type VisualOutputs = ReadonlyMap<string, VisualOutput>;

/**
 * What a Visual Layer contributes this frame given what its Visual wrote:
 * each bound Slot's value goes through its binding (a number from 0 to 1
 * onto the anchors) and lands on its Target's Elements exactly as a Look
 * Layer row does. A Slot bound to nothing, and a Target the Visual wrote
 * nothing for, contribute nothing.
 */
export function visualContributions(
  document: Document,
  layer: VisualLayer,
  output: VisualOutput | undefined,
): Contributions {
  const best = new Map<string, Map<AttributeKey, Candidate>>();
  if (output === undefined) return best;
  const { expanded } = visualTargets(document, layer);
  for (const [slot, byTarget] of output) {
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
