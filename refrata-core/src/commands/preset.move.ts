import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { treeMove } from "../document/tree.ts";

/** Places a Preset after a sibling (or first) at the root or in a Group; a Group carries its contents. */
export const presetMove = defineCommand({
  name: "preset.move",
  kind: "authoring",
  description: "Move a Preset within or across Groups.",
  payload: z
    .object({
      presetId: z.string().min(1),
      parentId: z.string().min(1).nullable(),
      /** Sibling to land after in the destination; null for the top. */
      after: z.string().min(1).nullable(),
    })
    .strict(),
  label: () => "Move Preset",
  coalesceKey: ({ presetId }) => `preset.move:${presetId}`,
  apply({ document, payload }) {
    const preset = document.presets[payload.presetId];
    if (preset === undefined)
      return rejected(`Preset “${payload.presetId}” does not exist.`);
    const patches = treeMove(
      { name: "presets", table: document.presets, noun: "Preset" },
      preset,
      payload.parentId,
      payload.after,
    );
    return "error" in patches ? rejected(patches.error) : accepted(patches);
  },
});
