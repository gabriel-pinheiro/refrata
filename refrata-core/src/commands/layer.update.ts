import { z } from "zod";

import { linkAt, linkSourceName, linksUnder } from "../address/links.ts";
import { accepted, defineCommand, rejected } from "../command/command.ts";
import { BlendModeSchema, isTargetedLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import type { Patch } from "../document/patch.ts";
import { regionPlacePrefix, toCenterRegion } from "../document/region.ts";

/** Why a Layer field a Controller drives cannot be edited by hand, or undefined. */
function controlled(
  document: Document,
  address: string,
  label: string,
): string | undefined {
  const link = linkAt(document, address);
  if (link === undefined) return undefined;
  return `${label} is controlled by ${linkSourceName(document, link)}.`;
}

/**
 * Settings of a Layer, each optional so one call changes any subset:
 * enabled and opacity on every kind, Blend Mode on every kind but a Group.
 * Enabled and opacity are also Addresses (`layer/<id>/enabled`,
 * `layer/<id>/opacity`) and refuse a hand edit while a Controller drives
 * them; the Layer Fade fields are Addresses only (`layer/<id>/fade/...`),
 * written with `address.edit`. Going to the Blend Mode `add`, a Region by
 * corners becomes its center and size, since on `add` it is an offset; one
 * with an Aim linked to a Preset refuses, a Preset holding places.
 */
export const layerUpdate = defineCommand({
  name: "layer.update",
  kind: "authoring",
  description: "Change a Layer's enabled state, opacity or Blend Mode.",
  payload: z
    .object({
      layerId: z.string().min(1),
      enabled: z.boolean().optional(),
      opacity: z.number().min(0).max(1).optional(),
      blendMode: BlendModeSchema.optional(),
    })
    .strict(),
  label: ({ enabled, ...rest }) =>
    enabled !== undefined && Object.keys(rest).length === 1
      ? enabled
        ? "Enable Layer"
        : "Disable Layer"
      : "Change Layer settings",
  coalesceKey: ({ layerId, ...fields }) =>
    `layer.update:${layerId}:${Object.keys(fields).sort().join(",")}`,
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (layer === undefined)
      return rejected(`Layer “${payload.layerId}” does not exist.`);
    const patches: Patch[] = [];
    const set = (field: string, value: unknown): void => {
      if ((layer as Record<string, unknown>)[field] === value) return;
      patches.push({ op: "set", path: ["layers", layer.id, field], value });
    };
    if (payload.enabled !== undefined) {
      const problem = controlled(
        document,
        `layer/${layer.id}/enabled`,
        "Enabled",
      );
      if (problem !== undefined) return rejected(problem);
      set("enabled", payload.enabled);
    }
    if (payload.opacity !== undefined) {
      const problem = controlled(
        document,
        `layer/${layer.id}/opacity`,
        "Opacity",
      );
      if (problem !== undefined) return rejected(problem);
      set("opacity", payload.opacity);
    }
    if (payload.blendMode !== undefined) {
      if (!isTargetedLayer(layer))
        return rejected("A Group has no Blend Mode.");
      const region = layer.kind === "visual" ? layer.region : undefined;
      if (
        payload.blendMode === "add" &&
        layer.blendMode !== "add" &&
        region !== undefined
      ) {
        const link = linksUnder(document.links, regionPlacePrefix(layer.id))[0];
        if (link !== undefined)
          return rejected(
            `The Region of “${layer.name}” is linked to ${linkSourceName(document, link)}, which holds places; on Add a Region is an offset from what is below. Unlink its Aims first.`,
          );
        if (region.form === "corners")
          patches.push({
            op: "set",
            path: ["layers", layer.id, "region"],
            value: toCenterRegion(region),
          });
      }
      set("blendMode", payload.blendMode);
    }
    return accepted(patches);
  },
});
