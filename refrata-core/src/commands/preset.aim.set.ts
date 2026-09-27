import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { forBothAxes } from "./layer.aim.set.ts";
import { presetRowSet } from "./preset.row.set.ts";

/**
 * Ticks an Aim on: the `pan` and `tilt` rows of one or more row refs of a
 * Preset, as `preset.row.set` without a value ticks one, in one undo step.
 * A row already there is kept as it is.
 */
export const presetAimSet = defineCommand({
  name: "preset.aim.set",
  kind: "authoring",
  description:
    "Tick an Aim on: the pan and tilt rows of a Preset's Elements, or of all (All Elements), as one undo step. A row already there is kept.",
  payload: z
    .object({
      presetId: z.string().min(1),
      elements: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  label: () => "Set Aim",
  apply({ document, payload, random }) {
    return forBothAxes(document, (current, attribute) =>
      presetRowSet.apply({
        document: current,
        payload: { ...payload, attribute },
        random,
      }),
    );
  },
});
