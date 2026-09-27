import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { treeRename } from "../document/tree.ts";

export const presetRename = defineCommand({
  name: "preset.rename",
  kind: "authoring",
  description: "Rename a Preset.",
  payload: z
    .object({
      presetId: z.string().min(1),
      name: z.string().trim().min(1).max(120),
    })
    .strict(),
  label: () => "Rename Preset",
  coalesceKey: ({ presetId }) => `preset.rename:${presetId}`,
  apply({ document, payload }) {
    const preset = document.presets[payload.presetId];
    if (preset === undefined)
      return rejected(`Preset “${payload.presetId}” does not exist.`);
    const patches = treeRename(
      { name: "presets", table: document.presets, noun: "Preset" },
      preset,
      payload.name,
    );
    return "error" in patches ? rejected(patches.error) : accepted(patches);
  },
});
