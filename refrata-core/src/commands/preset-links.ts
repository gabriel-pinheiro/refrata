import { resolveAddress } from "../address/address.ts";
import { linkAt, presetOfLink, presetLinkProblem } from "../address/links.ts";
import { unknownAddress } from "../address/unknown.ts";
import { effectiveRow } from "../composition/contributions.ts";
import { presetValueFor } from "../composition/preset-values.ts";
import { ALL_TARGETS_REF, type LookLayer } from "../document/composition.ts";
import {
  isPresetLink,
  type Document,
  type PresetLink,
} from "../document/document.ts";
import { rowRefStart } from "../document/look-rows.ts";
import type { Patch } from "../document/patch.ts";
import type { PresetRow } from "../document/preset.ts";
import { targetElements, type LocatedElement } from "../document/targets.ts";
import { generateId } from "../ids.ts";
import type { ParameterValue } from "../parameters.ts";
import { isAttributeKey, type AttributeKey } from "../rig/attributes.ts";
import { attributeOwners } from "../composition/contributions.ts";
import { namedPlace, seedFromPlace } from "./region-links.ts";

/** The Look Layer row an Address names: its Layer, row ref and Attribute. */
export interface NamedRow {
  readonly layer: LookLayer;
  readonly ref: string;
  readonly attribute: AttributeKey;
}

/** The Look Layer row `address` writes, or why a Preset cannot drive that Address. */
export function namedRow(
  document: Document,
  address: string,
): NamedRow | { readonly error: string } {
  const resolved = resolveAddress(document, address);
  if (resolved === undefined)
    return { error: unknownAddress(document, address) };
  const problem = presetLinkProblem(resolved);
  if (problem !== undefined) return { error: problem };
  const [, layerId = "", field] = resolved.path;
  const layer = document.layers[layerId];
  const [ref, attribute] =
    field === "all"
      ? [ALL_TARGETS_REF, resolved.path[3]]
      : [resolved.path[3], resolved.path[4]];
  if (
    layer?.kind !== "look" ||
    ref === undefined ||
    attribute === undefined ||
    !isAttributeKey(attribute)
  )
    return { error: unknownAddress(document, address) };
  return { layer, ref, attribute };
}

/**
 * Patches linking the Preset `presetId` to each Address, or why one of them
 * cannot be linked: each must be a Look Layer row, or the place of an Aim
 * of a Region (`layer/<id>/region/<aim>/<axis>`). One linked elsewhere
 * moves to the Preset.
 */
export function presetLinkPatches(
  document: Document,
  presetId: string,
  addresses: readonly string[],
): Patch[] | { readonly error: string } {
  const patches: Patch[] = [];
  for (const address of new Set(addresses)) {
    const driven = namedPlace(document, address) ?? namedRow(document, address);
    if ("error" in driven) return driven;
    const existing = linkAt(document, address);
    if (
      existing !== undefined &&
      isPresetLink(existing) &&
      existing.presetId === presetId
    )
      continue;
    if (existing !== undefined)
      patches.push({ op: "remove", path: ["links", existing.id] });
    const id = generateId("link");
    const link: PresetLink = { id, presetId, address };
    patches.push({ op: "set", path: ["links", id], value: link });
  }
  return patches;
}

/** The Elements of a row's Targets, each once in Target order: what a Preset grown from the row lists. */
function rowElements(
  document: Document,
  { layer, ref }: NamedRow,
): readonly LocatedElement[] {
  const refs =
    ref === ALL_TARGETS_REF ? layer.targets.map((target) => target.ref) : [ref];
  const found = new Map<string, LocatedElement>();
  for (const target of refs)
    for (const located of targetElements(document, target))
      if (!found.has(located.ref)) found.set(located.ref, located);
  return [...found.values()];
}

/** What one Element shows from a row right now, so a Preset grown from the row leaves the rig as it is: the row's value, its Preset's for this Element, or where a fresh row starts. */
function shownValue(
  document: Document,
  row: NamedRow,
  located: LocatedElement,
): ParameterValue {
  const { layer, ref, attribute } = row;
  const address = `layer/${layer.id}/row/${ref}/${attribute}`;
  const link = linkAt(document, address);
  const preset = link === undefined ? undefined : presetOfLink(document, link);
  const owner = attributeOwners(located, attribute)[0];
  if (preset !== undefined && owner !== undefined) {
    const value = presetValueFor(
      document,
      preset,
      located.fixture.id,
      located.elements,
      owner,
      attribute,
    );
    if (value !== undefined) return value;
  }
  return (
    effectiveRow(document, layer, ref, attribute)?.value ??
    rowRefStart(document, layer, located.ref, attribute)
  );
}

/**
 * The Elements and rows a Preset starts with when it grows out of Look
 * Layer rows or the Aims of a Region: every Element their Targets stand
 * for, each holding what it shows from them now, so linking changes
 * nothing on the rig.
 */
export function seedFromRows(
  document: Document,
  addresses: readonly string[],
):
  | {
      readonly elements: string[];
      readonly rows: Record<string, Record<string, PresetRow>>;
    }
  | { readonly error: string } {
  const elements: string[] = [];
  const rows: Record<string, Record<string, PresetRow>> = {};
  for (const address of new Set(addresses)) {
    const place = namedPlace(document, address);
    if (place !== undefined) {
      if ("error" in place) return place;
      for (const [ref, row] of seedFromPlace(document, place)) {
        if (!elements.includes(ref)) elements.push(ref);
        rows[ref] = { ...rows[ref], [place.axis]: row };
      }
      continue;
    }
    const row = namedRow(document, address);
    if ("error" in row) return row;
    for (const located of rowElements(document, row)) {
      if (!elements.includes(located.ref)) elements.push(located.ref);
      rows[located.ref] = {
        ...rows[located.ref],
        [row.attribute]: { value: shownValue(document, row, located) },
      };
    }
  }
  return { elements, rows };
}
