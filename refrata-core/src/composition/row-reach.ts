import { resolveAddress } from "../address/address.ts";
import {
  ALL_TARGETS_REF,
  isAllTargetsRef,
  type LookLayer,
} from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import type { ValuePreset } from "../document/preset.ts";
import { targetElements, targetLabel } from "../document/targets.ts";
import type { NumberBounds } from "../parameters.ts";
import { isAttributeKey, type AttributeKey } from "../rig/attributes.ts";
import { elementRef } from "../rig/elements.ts";
import { attributeOwners } from "./contributions.ts";

/** One Element a row is measured against, with the range its own number Parameter for the row's Attribute declares. */
export interface ReachedRange {
  /** The Element reference. */
  readonly ref: string;
  /** "Mover 2", or "Strobe › Panel 3" for a part. */
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

/**
 * The Elements a Look Layer row is measured against for a number Attribute,
 * each with its own Parameter's range: its limits and whom a value is
 * flagged beyond. A Target counts its Elements (a Set its members), each
 * one owning the Attribute or else its descendants that do, as Resolve
 * lands a row. The All Targets row counts every Element of every Target,
 * including Targets that override it with a row of their own: its limits
 * say what the Layer's fixtures can do, not where the row lands this
 * moment, so they do not change as Targets override it. Each Element is
 * listed once, in Target order.
 */
export function rowReach(
  document: Document,
  layer: LookLayer,
  ref: string,
  attribute: AttributeKey,
): readonly ReachedRange[] {
  return reachOf(
    document,
    isAllTargetsRef(ref) ? layer.targets.map((target) => target.ref) : [ref],
    attribute,
  );
}

/**
 * The Elements a Preset row is measured against for a number Attribute: an
 * Element's row counts that Element, or its descendants that own the
 * Attribute; the All Elements row counts every Element of the Preset.
 */
export function presetRowReach(
  document: Document,
  preset: ValuePreset,
  ref: string,
  attribute: AttributeKey,
): readonly ReachedRange[] {
  return reachOf(
    document,
    isAllTargetsRef(ref) ? preset.elements : [ref],
    attribute,
  );
}

function reachOf(
  document: Document,
  refs: readonly string[],
  attribute: AttributeKey,
): readonly ReachedRange[] {
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
 * The reach of the Look Layer row or Preset row an Address names, found
 * from where the Address writes; none for any other Address, whose own
 * range is then its limit.
 */
export function addressReach(
  document: Document,
  address: string,
): readonly ReachedRange[] {
  const path = resolveAddress(document, address)?.path;
  if (path === undefined) return [];
  const [table, id = "", field] = path;
  const [ref, attribute] =
    field === "all" ? [ALL_TARGETS_REF, path[3]] : [path[3], path[4]];
  if (
    ref === undefined ||
    attribute === undefined ||
    !isAttributeKey(attribute)
  )
    return [];
  if (table === "layers") {
    const layer = document.layers[id];
    return layer?.kind === "look"
      ? rowReach(document, layer, ref, attribute)
      : [];
  }
  if (table === "presets") {
    const preset = document.presets[id];
    return preset?.kind === "preset"
      ? presetRowReach(document, preset, ref, attribute)
      : [];
  }
  return [];
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
 * `value` held to the limits, where `current` is what is stored now. A
 * value stored beyond a limit by another route (`refrata set`, an older
 * file, a range that shrank) may stay where it is or move back in, but
 * never further out; otherwise the value stops at the limit.
 */
export function clampWithin(
  value: number,
  current: number | undefined,
  limits: NumberBounds,
): number {
  const min = Math.min(limits.min, current ?? limits.min);
  const max = Math.max(limits.max, current ?? limits.max);
  return Math.min(max, Math.max(min, value));
}

/** `value` moved by `delta` and held to the limits as `clampWithin` holds it: a nudge outward from beyond a limit leaves the value, a nudge inward moves it. */
export function nudgeWithin(
  value: number,
  delta: number,
  limits: NumberBounds,
): number {
  return clampWithin(value + delta, value, limits);
}

/** The reached Elements that cannot go to `value`, beyond their own range. */
export function outOfReach(
  reach: readonly ReachedRange[],
  value: number,
): readonly ReachedRange[] {
  return reach.filter((range) => value < range.min || value > range.max);
}
