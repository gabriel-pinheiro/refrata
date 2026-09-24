import type { ParameterDefinition, ParameterValue } from "../parameters.ts";
import { ATTRIBUTE_KEYS, type AttributeKey } from "../rig/attributes.ts";
import {
  isAllTargetsRef,
  type LookLayer,
  type LookRow,
} from "./composition.ts";
import type { PatchPath } from "./patch.ts";
import {
  attributeDefinition,
  locateElement,
  locateSet,
  rowDefinition,
  targetAttributes,
  targetElements,
  targetLabel,
  type TargetSource,
} from "./targets.ts";

/**
 * One Look Layer's rows seen through a row ref: a Target ref reaches that
 * Target's rows, and `ALL_TARGETS_REF` reaches the "All Targets" rows that
 * every Target takes unless its own row overrides them. Commands, Addresses
 * and the inspector all go through here, so the two kinds of row are one
 * shape to them.
 */
export const ALL_TARGETS_LABEL = "All Targets";

/** Every Attribute found across the Layer's Targets, in vocabulary order: what an "All Targets" row can name. */
export function layerAttributes(
  document: TargetSource,
  layer: LookLayer,
): readonly AttributeKey[] {
  const found = new Set<AttributeKey>();
  for (const target of layer.targets)
    for (const key of targetAttributes(document, target.ref)) found.add(key);
  return ATTRIBUTE_KEYS.filter((key) => found.has(key));
}

/**
 * The Attributes a row ref can hold rows for: on an Element its own and its
 * parts' Parameters, on All Targets those found across the Targets, and on a
 * Set the whole vocabulary, since a rule Set's members may still be on their
 * way and a row waiting for them is the point of targeting the Set.
 */
export function rowRefAttributes(
  document: TargetSource,
  layer: LookLayer,
  ref: string,
): readonly AttributeKey[] {
  if (isAllTargetsRef(ref)) return layerAttributes(document, layer);
  return locateSet(document, ref) === undefined
    ? targetAttributes(document, ref)
    : ATTRIBUTE_KEYS;
}

/** Whether `ref` is the All Targets ref or one of the Layer's Targets. */
export function hasRowRef(layer: LookLayer, ref: string): boolean {
  return (
    isAllTargetsRef(ref) || layer.targets.some((target) => target.ref === ref)
  );
}

/** The stored rows under a row ref, by Attribute. */
export function rowsAt(
  layer: LookLayer,
  ref: string,
): Readonly<Record<string, LookRow>> {
  return isAllTargetsRef(ref) ? layer.all : (layer.rows[ref] ?? {});
}

/** The stored row for one Attribute under a row ref, or undefined when released. */
export function storedRow(
  layer: LookLayer,
  ref: string,
  attribute: string,
): LookRow | undefined {
  return rowsAt(layer, ref)[attribute];
}

/** The document path of a row, for patches and Address paths. */
export function rowPath(
  layerId: string,
  ref: string,
  attribute: string,
): PatchPath {
  return isAllTargetsRef(ref)
    ? ["layers", layerId, "all", attribute]
    : ["layers", layerId, "rows", ref, attribute];
}

/** What a row under a row ref is checked and drawn against. */
export function rowRefDefinition(
  document: TargetSource,
  ref: string,
  attribute: AttributeKey,
): ParameterDefinition {
  return isAllTargetsRef(ref)
    ? attributeDefinition(attribute)
    : rowDefinition(document, ref, attribute);
}

/**
 * The value a row starts at when ticked on: an Element's Highlight for the
 * Attribute when its Mode declares one (dimmer full, colour white), so a
 * fresh row lights the fixture, else the Parameter's Default. An All
 * Targets row takes the Highlight of the first of the Layer's Targets, in
 * Target order with a Set standing for its members, whose Element declares
 * one. A Set's own row has no single Element, so it starts at the Default.
 */
export function rowRefStart(
  document: TargetSource,
  layer: LookLayer,
  ref: string,
  attribute: AttributeKey,
): ParameterValue {
  const elements = isAllTargetsRef(ref)
    ? layer.targets.flatMap((target) => targetElements(document, target.ref))
    : (locateElement(document, ref) ?? []);
  const highlight = [elements]
    .flat()
    .map((located) => located.element.parameters[attribute]?.highlight)
    .find((value) => value !== undefined);
  return highlight ?? rowRefDefinition(document, ref, attribute).default;
}

/** "All Targets", or the Target's label. */
export function rowRefLabel(document: TargetSource, ref: string): string {
  return isAllTargetsRef(ref) ? ALL_TARGETS_LABEL : targetLabel(document, ref);
}
