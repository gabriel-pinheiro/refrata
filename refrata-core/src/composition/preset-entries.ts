import { linkAt, presetOfLink } from "../address/links.ts";
import { ALL_TARGETS_REF, type LookLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import type { ValuePreset } from "../document/preset.ts";
import {
  targetElements,
  targetLabel,
  type LocatedElement,
} from "../document/targets.ts";
import type { ParameterValue } from "../parameters.ts";
import type { AttributeKey } from "../rig/attributes.ts";
import { elementRef } from "../rig/elements.ts";
import { attributeOwners, rowAddress } from "./contributions.ts";
import { presetValueFor } from "./preset-values.ts";

/** The Preset a Look Layer row is linked to, if any. */
export function rowPreset(
  document: Document,
  layerId: string,
  ref: string,
  attribute: string,
): ValuePreset | undefined {
  const link = linkAt(document, rowAddress(layerId, ref, attribute));
  return link === undefined ? undefined : presetOfLink(document, link);
}

/** One Element a row reaches, with what it takes from the Preset the row is linked to; `value` absent, the Preset has no entry for it. */
export interface PresetEntry {
  /** The Element reference. */
  readonly ref: string;
  /** "Mover 2", or "Strobe › Panel 3" for a part. */
  readonly label: string;
  readonly value: ParameterValue | undefined;
}

/** The Elements a located Element stands for under an Attribute, each with what `preset` gives it. */
function entriesOf(
  document: Document,
  preset: ValuePreset,
  located: LocatedElement,
  attribute: AttributeKey,
): readonly PresetEntry[] {
  return attributeOwners(located, attribute).map((owner) => {
    const ref = elementRef(located.fixture.id, owner.key);
    return {
      ref,
      label: targetLabel(document, ref),
      value: presetValueFor(
        document,
        preset,
        located.fixture.id,
        located.elements,
        owner,
        attribute,
      ),
    };
  });
}

/**
 * What each Element a Look Layer row reaches takes from `preset` for the
 * row's Attribute, in Target order, each Element once: what Studio and the
 * CLI list under a row linked to a Preset. The All Targets row counts every
 * Element of every Target.
 */
export function presetRowValues(
  document: Document,
  layer: LookLayer,
  ref: string,
  attribute: AttributeKey,
  preset: ValuePreset,
): readonly PresetEntry[] {
  const refs =
    ref === ALL_TARGETS_REF ? layer.targets.map((target) => target.ref) : [ref];
  const entries = new Map<string, PresetEntry>();
  for (const target of refs)
    for (const located of targetElements(document, target))
      for (const entry of entriesOf(document, preset, located, attribute))
        if (!entries.has(entry.ref)) entries.set(entry.ref, entry);
  return [...entries.values()];
}
