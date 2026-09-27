import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { dropActions } from "../document/macros.ts";
import type { Patch } from "../document/patch.ts";
import {
  hasPresetRef,
  presetRowAddress,
  presetRowPath,
  presetStoredRow,
} from "../document/presets.ts";
import { removalWarnings } from "../document/removal.ts";
import { ATTRIBUTES, isAttributeKey } from "../rig/attributes.ts";
import { notElementOf, notPreset } from "./kind-problems.ts";

/**
 * Releasing a Preset row removes it, so the Element takes the All Elements
 * row, or nothing when that goes too, and drops any Link or Macro action
 * on the row.
 */
export const presetRowRelease = defineCommand({
  name: "preset.row.release",
  kind: "authoring",
  description:
    "Release a Preset row: the Attribute on those Elements, or on all (All Elements), says nothing again.",
  payload: z
    .object({
      presetId: z.string().min(1),
      elements: z.array(z.string().min(1)).min(1),
      attribute: z.string().min(1),
    })
    .strict(),
  label: ({ attribute }) =>
    `Release ${isAttributeKey(attribute) ? ATTRIBUTES[attribute].label : attribute}`,
  apply({ document, payload }) {
    const preset = document.presets[payload.presetId];
    if (preset?.kind !== "preset")
      return rejected(notPreset(document, payload.presetId));
    const addresses = new Set<string>();
    const patches: Patch[] = [];
    for (const ref of new Set(payload.elements)) {
      if (!hasPresetRef(preset, ref))
        return rejected(notElementOf(document, ref, preset.name));
      addresses.add(presetRowAddress(preset.id, ref, payload.attribute));
      if (presetStoredRow(preset, ref, payload.attribute) !== undefined)
        patches.push({
          op: "remove",
          path: presetRowPath(preset.id, ref, payload.attribute),
        });
    }
    for (const link of Object.values(document.links))
      if (addresses.has(link.address))
        patches.push({ op: "remove", path: ["links", link.id] });
    patches.push(
      ...dropActions(document, (action) => !addresses.has(action.address)),
    );
    const warnings = removalWarnings(document, patches, preset.name);
    return accepted(patches, undefined, warnings);
  },
});
