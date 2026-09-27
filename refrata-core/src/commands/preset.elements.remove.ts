import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { Patch } from "../document/patch.ts";
import { removalWarnings } from "../document/removal.ts";
import { notElementOf, notPreset } from "./kind-problems.ts";
import { dropLayerReferences } from "./layer.remove.ts";

/** Removing Elements from a Preset removes their rows, and the Links and Macro actions on those rows; a Layer linked to the Preset releases them. */
export const presetElementsRemove = defineCommand({
  name: "preset.elements.remove",
  kind: "authoring",
  description: "Remove Elements from a Preset, with their rows.",
  payload: z
    .object({
      presetId: z.string().min(1),
      refs: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  label: ({ refs }) =>
    refs.length === 1 ? "Remove Element" : `Remove ${refs.length} Elements`,
  apply({ document, payload }) {
    const preset = document.presets[payload.presetId];
    if (preset?.kind !== "preset")
      return rejected(notPreset(document, payload.presetId));
    const going = new Set(payload.refs);
    for (const ref of going)
      if (!preset.elements.includes(ref))
        return rejected(notElementOf(document, ref, preset.name));
    const patches: Patch[] = dropLayerReferences(
      document,
      [...going].map((ref) => `preset/${preset.id}/row/${ref}/`),
    );
    const warnings = removalWarnings(document, patches, preset.name);
    patches.push({
      op: "set",
      path: ["presets", preset.id, "elements"],
      value: preset.elements.filter((ref) => !going.has(ref)),
    });
    for (const ref of going)
      if (preset.rows[ref] !== undefined)
        patches.push({
          op: "remove",
          path: ["presets", preset.id, "rows", ref],
        });
    return accepted(patches, undefined, warnings);
  },
});
