import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { treeUngroup } from "../document/tree.ts";

/** Dissolves a Preset Group: its contents take its place, in their order. */
export const presetUngroup = defineCommand({
  name: "preset.ungroup",
  kind: "authoring",
  description: "Replace a Preset Group by its contents.",
  payload: z.object({ presetId: z.string().min(1) }).strict(),
  label: () => "Ungroup",
  apply({ document, payload }) {
    const group = document.presets[payload.presetId];
    if (group === undefined)
      return rejected(`Preset “${payload.presetId}” does not exist.`);
    const patches = treeUngroup(
      { name: "presets", table: document.presets, noun: "Preset" },
      group,
    );
    return "error" in patches ? rejected(patches.error) : accepted(patches);
  },
});
