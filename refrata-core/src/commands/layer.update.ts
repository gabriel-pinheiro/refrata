import { z } from "zod";

import { linkAt } from "../address/links.ts";
import { accepted, defineCommand, rejected } from "../command/command.ts";
import { BlendModeSchema, isTargetedLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import type { Patch } from "../document/patch.ts";

/** Why a Layer field a Controller drives cannot be edited by hand, or undefined. */
function controlled(
  document: Document,
  address: string,
  label: string,
): string | undefined {
  const link = linkAt(document, address);
  if (link === undefined) return undefined;
  return `${label} is controlled by ${document.controllers[link.controllerId]?.name ?? "a Controller"}.`;
}

/**
 * Settings of a Layer, each optional so one call changes any subset:
 * enabled on every kind, opacity and Blend Mode on every kind but a
 * Group. Enabled
 * and opacity are also Addresses (`layer/<id>/enabled`, `layer/<id>/opacity`)
 * and refuse a hand edit while a Controller drives them.
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
      if (!isTargetedLayer(layer)) return rejected("A Group has no opacity.");
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
      set("blendMode", payload.blendMode);
    }
    return accepted(patches);
  },
});
