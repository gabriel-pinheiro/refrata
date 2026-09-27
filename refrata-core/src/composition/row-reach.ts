import { linkAt } from "../address/links.ts";
import { isAllTargetsRef, type LookLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import { storedRow } from "../document/look-rows.ts";
import { targetElements, targetLabel } from "../document/targets.ts";
import type { NumberBounds } from "../parameters.ts";
import type { AttributeKey } from "../rig/attributes.ts";
import { elementRef } from "../rig/elements.ts";
import { attributeOwners, rowAddress } from "./contributions.ts";

/** One Element a row lands on, with the range its own number Parameter for the row's Attribute declares. */
export interface ReachedRange {
  /** The Element reference. */
  readonly ref: string;
  /** "Mover 2", or "Strobe › Panel 3" for a part. */
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

/**
 * The Elements a Look Layer row lands on for a number Attribute, each with
 * its own Parameter's range, found as Resolve lands the row: a Target
 * reaches its Elements (a Set its members), each one owning the Attribute
 * or else its descendants that do. The All Targets row reaches the Elements
 * of every Target that has no row of its own for the Attribute, stored or
 * linked, since such a row overrides it. Each Element is listed once, in
 * Target order.
 */
export function rowReach(
  document: Document,
  layer: LookLayer,
  ref: string,
  attribute: AttributeKey,
): readonly ReachedRange[] {
  const refs = isAllTargetsRef(ref)
    ? layer.targets
        .map((target) => target.ref)
        .filter(
          (target) =>
            storedRow(layer, target, attribute) === undefined &&
            linkAt(document, rowAddress(layer.id, target, attribute)) ===
              undefined,
        )
    : [ref];
  const reached = new Map<string, ReachedRange>();
  for (const target of refs)
    for (const located of targetElements(document, target)) {
      for (const owner of attributeOwners(located, attribute)) {
        const definition = owner.parameters[attribute]?.definition;
        const elementKey = elementRef(located.fixture.id, owner.key);
        if (definition?.kind !== "number" || reached.has(elementKey)) continue;
        reached.set(elementKey, {
          ref: elementKey,
          label: targetLabel(document, elementKey),
          min: definition.min,
          max: definition.max,
        });
      }
    }
  return [...reached.values()];
}

/**
 * The limits an Aim's axis is typed and nudged within: the widest range the
 * reached Elements cover together, inside `bounds` (the Address's own
 * range), or `bounds` itself while the row reaches nothing.
 */
export function reachLimits(
  reach: readonly ReachedRange[],
  bounds: NumberBounds,
): NumberBounds {
  if (reach.length === 0) return { min: bounds.min, max: bounds.max };
  return {
    min: Math.max(bounds.min, Math.min(...reach.map((range) => range.min))),
    max: Math.min(bounds.max, Math.max(...reach.map((range) => range.max))),
  };
}

/**
 * `value` moved by `delta`, stopped at the limits. A value already beyond
 * a limit (typed elsewhere, or a range that shrank) is not pulled back by
 * a nudge outward; it only moves when nudged back in.
 */
export function nudgeWithin(
  value: number,
  delta: number,
  limits: NumberBounds,
): number {
  const next = value + delta;
  if (delta > 0) return Math.min(next, Math.max(value, limits.max));
  if (delta < 0) return Math.max(next, Math.min(value, limits.min));
  return value;
}

/** The reached Elements that cannot go to `value`, beyond their own range. */
export function outOfReach(
  reach: readonly ReachedRange[],
  value: number,
): readonly ReachedRange[] {
  return reach.filter((range) => value < range.min || value > range.max);
}
