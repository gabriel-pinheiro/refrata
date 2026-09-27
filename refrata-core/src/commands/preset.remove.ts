import { z } from "zod";

import { resolveAddress } from "../address/address.ts";
import { accepted, defineCommand, rejected } from "../command/command.ts";
import { isPresetLink, tableEntries } from "../document/document.ts";
import { getAtPath, type Patch } from "../document/patch.ts";
import { descendantPresets } from "../document/presets.ts";
import { removalWarnings } from "../document/removal.ts";
import { dropLayerReferences } from "./layer.remove.ts";

/**
 * Removing a Preset removes the Links to it and releases the rows they
 * drove, since a row cannot keep one value per Element; the warning names
 * the Layers. The Links and Macro actions on the Preset's own rows go too.
 * A Group goes with its contents.
 */
export const presetRemove = defineCommand({
  name: "preset.remove",
  kind: "authoring",
  description:
    "Remove a Preset or a Group with its contents; the Look Layer rows linked to it are released.",
  payload: z.object({ presetId: z.string().min(1) }).strict(),
  label: () => "Remove Preset",
  apply({ document, payload }) {
    const preset = document.presets[payload.presetId];
    if (preset === undefined)
      return rejected(`Preset “${payload.presetId}” does not exist.`);
    const going = new Set<string>([
      preset.id,
      ...descendantPresets(document.presets, preset.id).map((row) => row.id),
    ]);
    const patches: Patch[] = dropLayerReferences(
      document,
      [...going].map((id) => `preset/${id}/`),
    );
    const layers = new Set<string>();
    for (const link of tableEntries(document.links)) {
      if (!isPresetLink(link) || !going.has(link.presetId)) continue;
      patches.push({ op: "remove", path: ["links", link.id] });
      const resolved = resolveAddress(document, link.address);
      if (resolved === undefined) continue;
      const row = resolved.path.slice(0, -1);
      if (getAtPath(document, row) !== undefined)
        patches.push({ op: "remove", path: row });
      const layer = document.layers[resolved.path[1] ?? ""];
      if (layer !== undefined) layers.add(layer.name);
    }
    const warnings = removalWarnings(
      document,
      patches,
      preset.name,
      layers.size === 0
        ? []
        : [
            `Released the rows linked to it on ${[...layers].map((name) => `“${name}”`).join(", ")}`,
          ],
    );
    for (const id of going)
      patches.push({ op: "remove", path: ["presets", id] });
    return accepted(patches, undefined, warnings);
  },
});
