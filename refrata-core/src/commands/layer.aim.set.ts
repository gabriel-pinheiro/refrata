import { z } from "zod";

import {
  accepted,
  defineCommand,
  type CommandOutcome,
} from "../command/command.ts";
import { applyPatches, type Patch } from "../document/patch.ts";
import type { Document } from "../document/document.ts";
import { layerRowSet } from "./layer.row.set.ts";

/** The two Attributes of an Aim, in the order its rows are written. */
export const AIM_ATTRIBUTES = ["pan", "tilt"] as const;

/**
 * Runs one row command's `apply` for each axis of an Aim in turn, each on
 * the document the previous left, and gathers their patches and warnings
 * into one outcome: the pair as one undo step, with each axis following
 * that command's own rules.
 */
export function forBothAxes(
  document: Document,
  apply: (document: Document, attribute: string) => CommandOutcome,
): CommandOutcome {
  let current = document;
  const patches: Patch[] = [];
  const warnings: string[] = [];
  for (const attribute of AIM_ATTRIBUTES) {
    const outcome = apply(current, attribute);
    if (!outcome.ok) return outcome;
    patches.push(...outcome.patches);
    warnings.push(...(outcome.warnings ?? []));
    current = applyPatches(current, outcome.patches);
  }
  return accepted(
    patches,
    undefined,
    warnings.length === 0 ? undefined : warnings,
  );
}

/**
 * Ticks an Aim on: the `pan` and `tilt` rows of one or more row refs of a
 * Look Layer, as `layer.row.set` without a value ticks one, in one undo
 * step. A row already there is kept as it is.
 */
export const layerAimSet = defineCommand({
  name: "layer.aim.set",
  kind: "authoring",
  description:
    "Tick an Aim on: the pan and tilt rows of a Look Layer's Targets, or of All Targets, as one undo step. A new row starts at the Element's Highlight when its Mode declares one, else the Default; a row already there is kept.",
  payload: z
    .object({
      layerId: z.string().min(1),
      targets: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  label: () => "Set Aim",
  apply({ document, payload, random }) {
    return forBothAxes(document, (current, attribute) =>
      layerRowSet.apply({
        document: current,
        payload: { ...payload, attribute },
        random,
      }),
    );
  },
});
