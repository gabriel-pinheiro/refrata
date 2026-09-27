import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { treeDuplicate } from "../document/tree.ts";
import { generateId, id } from "../ids.ts";

/** A copy of the Preset with its Elements and rows, right after the original; no Layer is linked to the copy, and the Links that drive the original's rows are not copied. */
export const presetDuplicate = defineCommand({
  name: "preset.duplicate",
  kind: "authoring",
  description:
    "Duplicate a Preset below itself, with its Elements and rows and without Links.",
  payload: z
    .object({
      presetId: z.string().min(1),
      id: z.string().min(1).optional(),
    })
    .strict(),
  label: () => "Duplicate Preset",
  apply({ document, payload }) {
    const source = document.presets[payload.presetId];
    if (source === undefined)
      return rejected(`Preset “${payload.presetId}” does not exist.`);
    const copyId =
      payload.id === undefined
        ? generateId("preset")
        : id("preset", payload.id);
    const patches = treeDuplicate(
      { name: "presets", table: document.presets, noun: "Preset" },
      source,
      copyId,
      () => generateId("preset"),
    );
    return "error" in patches ? rejected(patches.error) : accepted(patches);
  },
});
