import { z } from "zod";

import { defineCommand } from "../command/command.ts";
import { forBothAxes } from "./layer.aim.set.ts";
import { layerRowRelease } from "./layer.row.release.ts";

/**
 * Releases an Aim: the `pan` and `tilt` rows of one or more row refs of a
 * Look Layer, as `layer.row.release` releases one, in one undo step, so
 * the Links and Macro actions on both axes go with them.
 */
export const layerAimRelease = defineCommand({
  name: "layer.aim.release",
  kind: "authoring",
  description:
    "Release an Aim: the pan and tilt rows of a Look Layer's Targets, or of All Targets, with their Links, as one undo step.",
  payload: z
    .object({
      layerId: z.string().min(1),
      targets: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  label: () => "Release Aim",
  apply({ document, payload, random }) {
    return forBothAxes(document, (current, attribute) =>
      layerRowRelease.apply({
        document: current,
        payload: { ...payload, attribute },
        random,
      }),
    );
  },
});
