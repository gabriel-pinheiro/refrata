import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { forBothAxes } from "./layer.aim.set.ts";
import { presetRowRelease } from "./preset.row.release.ts";

/**
 * Releases an Aim: the `pan` and `tilt` rows of one or more row refs of a
 * Preset, as `preset.row.release` releases one, in one undo step, so the
 * Links and Macro actions on both axes go with them.
 */
export const presetAimRelease = defineCommand({
  name: "preset.aim.release",
  kind: "authoring",
  description:
    "Release an Aim: the pan and tilt rows of a Preset's Elements, or of all (All Elements), with their Links, as one undo step.",
  payload: z
    .object({
      presetId: z.string().min(1),
      elements: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  label: () => "Release Aim",
  apply({ document, payload, random }) {
    return forBothAxes(document, (current, attribute) =>
      presetRowRelease.apply({
        document: current,
        payload: { ...payload, attribute },
        random,
      }),
    );
  },
});
