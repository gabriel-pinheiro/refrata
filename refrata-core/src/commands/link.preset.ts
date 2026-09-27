import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { notPreset } from "./kind-problems.ts";
import { presetLinkPatches } from "./preset-links.ts";

/**
 * Links one Preset to one or more Look Layer rows, or Aims of a Region, in
 * one step, so an Aim's two axes, or the same row on many Layers, are one
 * undo entry. A row linked elsewhere moves to the Preset. Each Element
 * reached then takes the Preset's row for it, else its All Elements row,
 * else is released.
 */
export const linkPreset = defineCommand({
  name: "link.preset",
  kind: "authoring",
  description:
    "Link a Preset to Look Layer rows (layer/<id>/row/<target|all>/<attribute>) or to the Aims of a Visual Layer's Region (layer/<id>/region/<from|to|center>/<pan|tilt>); one linked elsewhere moves. Each Element reached takes its own value from the Preset.",
  payload: z
    .object({
      presetId: z.string().min(1),
      addresses: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  label: ({ addresses, presetId }, { document }) => {
    const name = document.presets[presetId]?.name ?? "Preset";
    return addresses.length === 1
      ? `Link to ${name}`
      : `Link ${String(addresses.length)} Parameters to ${name}`;
  },
  apply({ document, payload }) {
    const preset = document.presets[payload.presetId];
    if (preset?.kind !== "preset")
      return rejected(notPreset(document, payload.presetId));
    const patches = presetLinkPatches(document, preset.id, payload.addresses);
    return "error" in patches ? rejected(patches.error) : accepted(patches);
  },
});
