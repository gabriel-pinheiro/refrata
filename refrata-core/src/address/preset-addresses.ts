import { ALL_TARGETS_REF } from "../document/composition.ts";
import {
  hasPresetRef,
  presetRefLabel,
  presetRowAttributes,
  presetRowDefinition,
  presetRowPath,
  presetShownAttributes,
  valuePresets,
} from "../document/presets.ts";
import { isAttributeKey } from "../rig/attributes.ts";
import { elementRef } from "../rig/elements.ts";
import type { AddressPattern } from "./address.ts";
import { definitionAddress } from "./definition-address.ts";

/**
 * The row Addresses of a Preset: `preset/<id>/row/all/<attribute>` for an
 * All Elements row and `preset/<id>/row/<fixtureId>/<key>/<attribute>` for
 * an Element's. An All Elements row can name any Attribute of the
 * vocabulary; the ones listed are those it holds.
 */
function presetRowPattern(kind: "all" | "element"): AddressPattern {
  return {
    pattern:
      kind === "all"
        ? ["preset", "*", "row", ALL_TARGETS_REF, "*"]
        : ["preset", "*", "row", "*", "*", "*"],
    resolve: (document, captures) => {
      const presetId = captures[0] ?? "";
      const preset = document.presets[presetId];
      if (preset?.kind !== "preset") return undefined;
      const ref =
        kind === "all"
          ? ALL_TARGETS_REF
          : elementRef(captures[1] ?? "", captures[2] ?? "");
      const attribute = (kind === "all" ? captures[1] : captures[3]) ?? "";
      if (!hasPresetRef(preset, ref) || !isAttributeKey(attribute))
        return undefined;
      if (!presetRowAttributes(document, ref).includes(attribute))
        return undefined;
      const definition = presetRowDefinition(document, ref, attribute);
      return {
        label: definition.label,
        owner: `${preset.name} · ${presetRefLabel(document, ref)}`,
        path: [...presetRowPath(presetId, ref, attribute), "value"] as const,
        ...definitionAddress(definition),
      };
    },
    list: (document) =>
      valuePresets(document.presets).flatMap((preset) =>
        kind === "all"
          ? presetShownAttributes(document, preset, ALL_TARGETS_REF).map(
              (attribute) => [preset.id, attribute],
            )
          : preset.elements.flatMap((ref) =>
              presetShownAttributes(document, preset, ref).map((attribute) => [
                preset.id,
                ...ref.split("/"),
                attribute,
              ]),
            ),
      ),
  };
}

export const presetPatterns: readonly AddressPattern[] = [
  presetRowPattern("all"),
  presetRowPattern("element"),
];
