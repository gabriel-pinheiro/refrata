import type { ParameterDefinition, ParameterValue } from "../parameters.ts";
import { ATTRIBUTE_KEYS, type AttributeKey } from "../rig/attributes.ts";
import { ALL_TARGETS_REF, isAllTargetsRef } from "./composition.ts";
import type { Document, Table } from "./document.ts";
import type { Patch, PatchPath } from "./patch.ts";
import type { Preset, PresetRow, ValuePreset } from "./preset.ts";
import {
  attributeDefinition,
  locateElement,
  rowDefinition,
  targetAttributes,
  targetLabel,
  type TargetSource,
} from "./targets.ts";
import { childrenOf, descendantsOf, flattenTree } from "./tree.ts";

/**
 * One Preset's rows seen through a row ref, the way look-rows.ts sees a
 * Look Layer's: an Element reference reaches that Element's rows, and
 * `ALL_TARGETS_REF` reaches the rows every Element takes unless its own
 * row overrides them. Commands, Addresses and the inspector all go
 * through here.
 */
export const ALL_ELEMENTS_LABEL = "All Elements";

/** The Presets directly under the root (`parentId` null) or a Group, in order. */
export const childPresets = (
  presets: Table<Preset>,
  parentId: string | null,
): readonly Preset[] => childrenOf(presets, parentId);

/** Every Preset in navigator order: depth first from the root. */
export const flattenPresets = (presets: Table<Preset>): readonly Preset[] =>
  flattenTree(presets);

/** Every Preset below `presetId`, depth first; empty unless it is a Group. */
export const descendantPresets = (
  presets: Table<Preset>,
  presetId: string,
): readonly Preset[] => descendantsOf(presets, presetId);

/** The Presets (not Groups) in navigator order. */
export function valuePresets(presets: Table<Preset>): readonly ValuePreset[] {
  return flattenTree(presets).filter(
    (row): row is ValuePreset => row.kind === "preset",
  );
}

/** Every Attribute found across the Preset's Elements, in vocabulary order. */
export function presetAttributes(
  document: TargetSource,
  preset: ValuePreset,
): readonly AttributeKey[] {
  const found = new Set<AttributeKey>();
  for (const ref of preset.elements)
    for (const key of targetAttributes(document, ref)) found.add(key);
  return ATTRIBUTE_KEYS.filter((key) => found.has(key));
}

/**
 * The Attributes a row ref can hold rows for: on an Element its own and
 * its parts' Parameters; on All Elements the whole vocabulary, since the
 * Layers that link to a Preset bring Elements it does not list.
 */
export function presetRowAttributes(
  document: TargetSource,
  ref: string,
): readonly AttributeKey[] {
  return isAllTargetsRef(ref)
    ? ATTRIBUTE_KEYS
    : targetAttributes(document, ref);
}

/**
 * The Attributes a row ref is shown and listed with: an Element's own, and
 * for All Elements those found across the Preset's Elements plus the ones
 * it holds a row for.
 */
export function presetShownAttributes(
  document: TargetSource,
  preset: ValuePreset,
  ref: string,
): readonly AttributeKey[] {
  if (!isAllTargetsRef(ref)) return targetAttributes(document, ref);
  const shown = new Set<string>([
    ...presetAttributes(document, preset),
    ...Object.keys(preset.all),
  ]);
  return ATTRIBUTE_KEYS.filter((key) => shown.has(key));
}

/** Whether `ref` is the All Elements ref or one of the Preset's Elements. */
export function hasPresetRef(preset: ValuePreset, ref: string): boolean {
  return isAllTargetsRef(ref) || preset.elements.includes(ref);
}

/** The stored rows under a row ref, by Attribute. */
export function presetRowsAt(
  preset: ValuePreset,
  ref: string,
): Readonly<Record<string, PresetRow>> {
  return isAllTargetsRef(ref) ? preset.all : (preset.rows[ref] ?? {});
}

/** The stored row for one Attribute under a row ref, or undefined when released. */
export function presetStoredRow(
  preset: ValuePreset,
  ref: string,
  attribute: string,
): PresetRow | undefined {
  return presetRowsAt(preset, ref)[attribute];
}

/** The document path of a Preset row, for patches and Address paths. */
export function presetRowPath(
  presetId: string,
  ref: string,
  attribute: string,
): PatchPath {
  return isAllTargetsRef(ref)
    ? ["presets", presetId, "all", attribute]
    : ["presets", presetId, "rows", ref, attribute];
}

/** The Address of a Preset row's value. */
export function presetRowAddress(
  presetId: string,
  ref: string,
  attribute: string,
): string {
  return `preset/${presetId}/row/${ref}/${attribute}`;
}

/** What a row under a row ref is checked and drawn against. */
export function presetRowDefinition(
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
 * Attribute when its Mode declares one, else the Parameter's Default; an
 * All Elements row takes the Highlight of the first of the Preset's
 * Elements that declares one.
 */
export function presetRowStart(
  document: TargetSource,
  preset: ValuePreset,
  ref: string,
  attribute: AttributeKey,
): ParameterValue {
  const refs = isAllTargetsRef(ref) ? preset.elements : [ref];
  const highlight = refs
    .map(
      (element) =>
        locateElement(document, element)?.element.parameters[attribute]
          ?.highlight,
    )
    .find((value) => value !== undefined);
  return highlight ?? presetRowDefinition(document, ref, attribute).default;
}

/** "All Elements", or the Element's label. */
export function presetRefLabel(document: TargetSource, ref: string): string {
  return isAllTargetsRef(ref) ? ALL_ELEMENTS_LABEL : targetLabel(document, ref);
}

/** The row refs of a Preset in the order it shows them: All Elements, then its Elements. */
export function presetRefs(preset: ValuePreset): readonly string[] {
  return [ALL_TARGETS_REF, ...preset.elements];
}

/**
 * Patches dropping, from every Preset, the Elements `drop` names with
 * their rows: what the removal of a Fixture or an Element key takes with
 * it. Links and Macro actions on those rows are the caller's business.
 * Returns the row prefixes that went and how many Elements.
 */
export function dropPresetElements(
  document: Pick<Document, "presets">,
  drop: (ref: string) => boolean,
): {
  readonly patches: Patch[];
  readonly prefixes: string[];
  readonly dropped: number;
} {
  const patches: Patch[] = [];
  const prefixes: string[] = [];
  let dropped = 0;
  for (const preset of valuePresets(document.presets)) {
    const going = preset.elements.filter(drop);
    const stale = Object.keys(preset.rows).filter(
      (ref) => drop(ref) || !preset.elements.includes(ref),
    );
    if (going.length > 0) {
      dropped += going.length;
      patches.push({
        op: "set",
        path: ["presets", preset.id, "elements"],
        value: preset.elements.filter((ref) => !drop(ref)),
      });
    }
    for (const ref of stale)
      patches.push({ op: "remove", path: ["presets", preset.id, "rows", ref] });
    for (const ref of new Set([...going, ...stale]))
      prefixes.push(`preset/${preset.id}/row/${ref}/`);
  }
  return { patches, prefixes, dropped };
}
