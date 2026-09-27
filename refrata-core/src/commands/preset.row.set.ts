import { z } from "zod";

import { linkAt, linkSourceName } from "../address/links.ts";
import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { Patch } from "../document/patch.ts";
import type { PresetRow } from "../document/preset.ts";
import {
  hasPresetRef,
  presetRefLabel,
  presetRowAddress,
  presetRowAttributes,
  presetRowDefinition,
  presetRowPath,
  presetRowStart,
  presetStoredRow,
} from "../document/presets.ts";
import { ParameterValueSchema, validateParameterValue } from "../parameters.ts";
import { ATTRIBUTES, isAttributeKey } from "../rig/attributes.ts";
import { notElementOf, notPreset } from "./kind-problems.ts";

/**
 * Sets one Attribute's row on one or more row refs of a Preset: an Element,
 * or `all` for the All Elements row every Element takes unless its own row
 * overrides it. A row that did not exist and is given no value starts at
 * the Element's Highlight for the Attribute when its Mode declares one,
 * else the Parameter's Default, so ticking an Attribute on is this command
 * without a value. A row a Controller drives refuses the hand edit.
 */
export const presetRowSet = defineCommand({
  name: "preset.row.set",
  kind: "authoring",
  description:
    "Set a Preset row: an Attribute's value on one or more of its Elements, or on all (All Elements). Without a value a new row starts at the Element's Highlight when its Mode declares one, else the Parameter's Default.",
  payload: z
    .object({
      presetId: z.string().min(1),
      elements: z.array(z.string().min(1)).min(1),
      attribute: z.string().min(1),
      value: ParameterValueSchema.optional(),
    })
    .strict(),
  label: ({ attribute }) =>
    `Set ${isAttributeKey(attribute) ? ATTRIBUTES[attribute].label : attribute}`,
  coalesceKey: ({ presetId, elements, attribute }) =>
    `preset.row.set:${presetId}:${[...elements].sort().join(",")}:${attribute}`,
  apply({ document, payload }) {
    const preset = document.presets[payload.presetId];
    if (preset?.kind !== "preset")
      return rejected(notPreset(document, payload.presetId));
    const attribute = payload.attribute;
    if (!isAttributeKey(attribute))
      return rejected(`“${attribute}” is not an Attribute.`);
    const patches: Patch[] = [];
    for (const ref of new Set(payload.elements)) {
      if (!hasPresetRef(preset, ref))
        return rejected(notElementOf(document, ref, preset.name));
      if (!presetRowAttributes(document, ref).includes(attribute))
        return rejected(
          `${presetRefLabel(document, ref)} has no ${ATTRIBUTES[attribute].label}.`,
        );
      const definition = presetRowDefinition(document, ref, attribute);
      const existing = presetStoredRow(preset, ref, attribute);
      if (payload.value !== undefined) {
        const problem = validateParameterValue(definition, payload.value);
        if (problem !== undefined)
          return rejected(`${definition.label} ${problem}.`);
        const link = linkAt(
          document,
          presetRowAddress(preset.id, ref, attribute),
        );
        if (link !== undefined)
          return rejected(
            `${definition.label} is controlled by ${linkSourceName(document, link)}.`,
          );
      }
      const row: PresetRow = {
        value:
          payload.value ??
          existing?.value ??
          presetRowStart(document, preset, ref, attribute),
      };
      if (
        existing !== undefined &&
        JSON.stringify(existing.value) === JSON.stringify(row.value)
      )
        continue;
      patches.push({
        op: "set",
        path: presetRowPath(preset.id, ref, attribute),
        value: row,
      });
    }
    return accepted(patches);
  },
});
