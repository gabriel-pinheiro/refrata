import { effectiveAt } from "../address/links.ts";
import { ALL_TARGETS_REF } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import type { ValuePreset } from "../document/preset.ts";
import { presetRowAddress, presetStoredRow } from "../document/presets.ts";
import type { ParameterValue } from "../parameters.ts";
import type { AttributeKey } from "../rig/attributes.ts";
import { ancestorsOf, elementRef, type Element } from "../rig/elements.ts";

/** A Preset row as the show sees it: a Controller linked to it drives it; absent and unlinked it is released. */
function presetRowValue(
  document: Document,
  preset: ValuePreset,
  ref: string,
  attribute: AttributeKey,
): ParameterValue | undefined {
  return effectiveAt(
    document,
    presetRowAddress(preset.id, ref, attribute),
    presetStoredRow(preset, ref, attribute)?.value,
  );
}

/**
 * The value one Element takes from a Preset for an Attribute: the row of
 * the Element itself, else of its nearest ancestor that has one, as a row
 * on a Fixture fans down to its parts; else the All Elements row; else
 * nothing, and the Element is released.
 */
export function presetValueFor(
  document: Document,
  preset: ValuePreset,
  fixtureId: string,
  elements: readonly Element[],
  element: Element,
  attribute: AttributeKey,
): ParameterValue | undefined {
  for (const ancestor of ancestorsOf(elements, element.key)) {
    const value = presetRowValue(
      document,
      preset,
      elementRef(fixtureId, ancestor.key),
      attribute,
    );
    if (value !== undefined) return value;
  }
  return presetRowValue(document, preset, ALL_TARGETS_REF, attribute);
}
