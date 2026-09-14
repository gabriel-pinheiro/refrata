import { effectiveAt } from "../address/links.ts";
import { linksUnder } from "../address/links.ts";
import type { LookLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import { targetElements } from "../document/targets.ts";
import type { ParameterValue } from "../parameters.ts";
import { isAttributeKey, type AttributeKey } from "../rig/attributes.ts";
import { elementRef, subtreeOf } from "../rig/elements.ts";

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

interface Candidate extends Contribution {
  /** Whether the row sat on the Element's own Target, not an ancestor's. */
  readonly own: boolean;
  /** Position of the Target in the Layer's list; later wins among equals. */
  readonly index: number;
}

/** The Address of a row's value, and of its alpha. */
export function rowAddress(
  layerId: string,
  ref: string,
  attribute: string,
): string {
  return `layer/${layerId}/row/${ref}/${attribute}`;
}

export function rowAlphaAddress(
  layerId: string,
  ref: string,
  attribute: string,
): string {
  return `${rowAddress(layerId, ref, attribute)}/alpha`;
}

/**
 * The row a Look Layer makes for one Target and Attribute as the show sees
 * it: a Controller linked to the value or the alpha drives it; a row absent
 * and unlinked is released (undefined); alpha absent is 1.
 */
export function effectiveRow(
  document: Document,
  layer: LookLayer,
  ref: string,
  attribute: string,
): Contribution | undefined {
  const row = layer.rows[ref]?.[attribute];
  const value = effectiveAt(
    document,
    rowAddress(layer.id, ref, attribute),
    row?.value,
  );
  if (value === undefined) return undefined;
  const alpha = effectiveAt(
    document,
    rowAlphaAddress(layer.id, ref, attribute),
    row?.alpha ?? 1,
  );
  return { value, alpha: typeof alpha === "number" ? alpha : 1 };
}

/** The Attributes a Target has rows for: stored ones, plus any a Link drives without a stored row. */
function rowAttributes(
  document: Document,
  layer: LookLayer,
  ref: string,
): readonly AttributeKey[] {
  const keys = new Set(Object.keys(layer.rows[ref] ?? {}));
  const prefix = rowAddress(layer.id, ref, "");
  for (const link of linksUnder(document.links, prefix)) {
    const [attribute] = link.address.slice(prefix.length).split("/");
    if (attribute !== undefined) keys.add(attribute);
  }
  return [...keys].filter(isAttributeKey);
}

/**
 * What a Look Layer contributes this frame. Each Target expands to its
 * Elements (a Set to its members); a row lands on the Element when it owns
 * the Attribute, else on every descendant that does. Where two Targets reach
 * one Element for one Attribute, the Element's own Target beats a value
 * fanned down from an ancestor, and among equals the later Target wins.
 */
export function lookContributions(
  document: Document,
  layer: LookLayer,
): Contributions {
  const best = new Map<string, Map<AttributeKey, Candidate>>();
  layer.targets.forEach((target, index) => {
    const attributes = rowAttributes(document, layer, target.ref);
    if (attributes.length === 0) return;
    const rows = new Map<AttributeKey, Contribution>();
    for (const attribute of attributes) {
      const row = effectiveRow(document, layer, target.ref, attribute);
      if (row !== undefined) rows.set(attribute, row);
    }
    if (rows.size === 0) return;
    for (const located of targetElements(document, target.ref)) {
      const subtree = subtreeOf(located.elements, located.element.key);
      for (const [attribute, row] of rows) {
        const owners =
          attribute in located.element.parameters
            ? [located.element]
            : subtree.filter((element) => attribute in element.parameters);
        for (const owner of owners) {
          const ref = elementRef(located.fixture.id, owner.key);
          let byAttribute = best.get(ref);
          if (byAttribute === undefined) {
            byAttribute = new Map();
            best.set(ref, byAttribute);
          }
          const candidate: Candidate = {
            ...row,
            own: owner === located.element,
            index,
          };
          const current = byAttribute.get(attribute);
          if (current === undefined || beats(candidate, current))
            byAttribute.set(attribute, candidate);
        }
      }
    }
  });
  return best;
}

function beats(candidate: Candidate, current: Candidate): boolean {
  if (candidate.own !== current.own) return candidate.own;
  return candidate.index >= current.index;
}
