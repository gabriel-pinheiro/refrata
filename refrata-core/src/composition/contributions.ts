import {
  effectiveAt,
  linkAt,
  presetOfLink,
  linksUnder,
} from "../address/links.ts";
import { ALL_TARGETS_REF, type LookLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import { rowsAt, storedRow } from "../document/look-rows.ts";
import type { ValuePreset } from "../document/preset.ts";
import { targetElements, type LocatedElement } from "../document/targets.ts";
import type { ParameterValue } from "../parameters.ts";
import { isAttributeKey, type AttributeKey } from "../rig/attributes.ts";
import { elementRef, subtreeOf, type Element } from "../rig/elements.ts";
import { presetValueFor } from "./preset-values.ts";

/** One value for one Parameter of one Element with an alpha, from one Layer for one frame. */
export interface Contribution {
  readonly value: ParameterValue;
  readonly alpha: number;
}

/** Contributions by Element reference, then by Attribute. */
export type Contributions = ReadonlyMap<
  string,
  ReadonlyMap<AttributeKey, Contribution>
>;

export interface Candidate extends Contribution {
  /** Whether the row sat on the Element's own Target, not an ancestor's. */
  readonly own: boolean;
  /** Position of the Target in the Layer's list; later wins among equals. */
  readonly index: number;
}

/** The Address of a row's value: a Target's row, or an "All Targets" row through `ALL_TARGETS_REF`. */
export function rowAddress(
  layerId: string,
  ref: string,
  attribute: string,
): string {
  return `layer/${layerId}/row/${ref}/${attribute}`;
}

/**
 * The row a Look Layer holds under one row ref for one Attribute as the
 * show sees it: a Controller linked to the value drives it; a row absent
 * and unlinked is released (undefined). Alpha is stored but has no Address
 * or control yet, so it reads as stored, 1 when absent.
 */
export function effectiveRow(
  document: Document,
  layer: LookLayer,
  ref: string,
  attribute: string,
): Contribution | undefined {
  const row = storedRow(layer, ref, attribute);
  const value = effectiveAt(
    document,
    rowAddress(layer.id, ref, attribute),
    row?.value,
  );
  if (value === undefined) return undefined;
  return { value, alpha: row?.alpha ?? 1 };
}

/** A row linked to a Preset: each Element it reaches takes its own value from the Preset, at the row's alpha. */
interface PresetRowSource {
  readonly preset: ValuePreset;
  readonly alpha: number;
}

/**
 * What a row says this frame: one Contribution for everything it reaches,
 * or, linked to a Preset, the Preset each Element asks. Undefined when the
 * row is released.
 */
function rowSource(
  document: Document,
  layer: LookLayer,
  ref: string,
  attribute: string,
): Contribution | PresetRowSource | undefined {
  const link = linkAt(document, rowAddress(layer.id, ref, attribute));
  const preset = link === undefined ? undefined : presetOfLink(document, link);
  if (preset !== undefined)
    return { preset, alpha: storedRow(layer, ref, attribute)?.alpha ?? 1 };
  return effectiveRow(document, layer, ref, attribute);
}

/** The Attributes a row ref has rows for: stored ones, plus any a Link drives without a stored row. */
function rowAttributes(
  document: Document,
  layer: LookLayer,
  ref: string,
): readonly AttributeKey[] {
  const keys = new Set(Object.keys(rowsAt(layer, ref)));
  const prefix = rowAddress(layer.id, ref, "");
  for (const link of linksUnder(document.links, prefix)) {
    const [attribute] = link.address.slice(prefix.length).split("/");
    if (attribute !== undefined) keys.add(attribute);
  }
  return [...keys].filter(isAttributeKey);
}

/**
 * What a Look Layer contributes this frame. Each Target takes the "All
 * Targets" rows, its own rows overriding them Attribute by Attribute, and
 * expands to its Elements (a Set to its members); a row lands on the Element
 * when it owns the Attribute, else on every descendant that does. A row
 * linked to a Preset lands on the same Elements, each with the value the
 * Preset holds for it, and not at all on one the Preset has nothing for.
 * Where two
 * Targets reach one Element for one Attribute, the Element's own Target
 * beats a value fanned down from an ancestor, and among equals the later
 * Target wins.
 */
export function lookContributions(
  document: Document,
  layer: LookLayer,
): Contributions {
  const best = new Map<string, Map<AttributeKey, Candidate>>();
  const shared = rowAttributes(document, layer, ALL_TARGETS_REF);
  layer.targets.forEach((target, index) => {
    const attributes = new Set([
      ...shared,
      ...rowAttributes(document, layer, target.ref),
    ]);
    if (attributes.size === 0) return;
    const rows = new Map<AttributeKey, Contribution | PresetRowSource>();
    for (const attribute of attributes) {
      const row =
        rowSource(document, layer, target.ref, attribute) ??
        rowSource(document, layer, ALL_TARGETS_REF, attribute);
      if (row !== undefined) rows.set(attribute, row);
    }
    if (rows.size === 0) return;
    for (const located of targetElements(document, target.ref))
      for (const [attribute, row] of rows)
        landContribution(
          best,
          located,
          attribute,
          "preset" in row
            ? (owner) => {
                const value = presetValueFor(
                  document,
                  row.preset,
                  located.fixture.id,
                  located.elements,
                  owner,
                  attribute,
                );
                return value === undefined
                  ? undefined
                  : { value, alpha: row.alpha };
              }
            : row,
          index,
        );
  });
  return best;
}

/** Where a row for `attribute` lands on a located Element: the Element when it owns the Attribute, else every descendant that does. */
export function attributeOwners(
  located: LocatedElement,
  attribute: AttributeKey,
): readonly Element[] {
  return attribute in located.element.parameters
    ? [located.element]
    : subtreeOf(located.elements, located.element.key).filter(
        (element) => attribute in element.parameters,
      );
}

/**
 * Lands one Contribution of the Target at `index` on a located Element: on
 * the Element when it owns the Attribute, else on every descendant that
 * does, keeping per Element and Attribute the candidate that wins by the
 * Target rule. Given a function, each Element asks it for its own
 * Contribution and takes none when it answers undefined.
 */
export function landContribution(
  best: Map<string, Map<AttributeKey, Candidate>>,
  located: LocatedElement,
  attribute: AttributeKey,
  contribution: Contribution | ((owner: Element) => Contribution | undefined),
  index: number,
): void {
  for (const owner of attributeOwners(located, attribute)) {
    const landing =
      typeof contribution === "function" ? contribution(owner) : contribution;
    if (landing === undefined) continue;
    const ref = elementRef(located.fixture.id, owner.key);
    let byAttribute = best.get(ref);
    if (byAttribute === undefined) {
      byAttribute = new Map();
      best.set(ref, byAttribute);
    }
    const candidate: Candidate = {
      ...landing,
      own: owner === located.element,
      index,
    };
    const current = byAttribute.get(attribute);
    if (current === undefined || beats(candidate, current))
      byAttribute.set(attribute, candidate);
  }
}

function beats(candidate: Candidate, current: Candidate): boolean {
  if (candidate.own !== current.own) return candidate.own;
  return candidate.index >= current.index;
}
