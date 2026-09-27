import { z } from "zod";

import { resolveAddress } from "../address/address.ts";
import { writeAddress } from "../address/write.ts";
import {
  accepted,
  defineCommand,
  rejected,
  type CommandOutcome,
} from "../command/command.ts";
import type { Patch } from "../document/patch.ts";

/**
 * The authoring write of an Aim: the `pan` and `tilt` Addresses of one
 * owner, either or both, as one undoable step. Each axis follows the rule
 * of `address.edit`, so a linked axis refuses and nothing is written. The
 * step coalesces per pair of Addresses whichever axes each write moves, so
 * a held arrow key or a drag on the pad undoes as one.
 */
export const aimEdit = defineCommand({
  name: "aim.edit",
  kind: "authoring",
  description:
    "Edit an Aim as one undoable step: pan and tilt name the two number Addresses, such as layer/<id>/row/all/pan and layer/<id>/row/all/tilt, and value holds the degrees for either or both.",
  payload: z
    .object({
      pan: z.string().min(1),
      tilt: z.string().min(1),
      value: z
        .object({ pan: z.number().optional(), tilt: z.number().optional() })
        .strict()
        .refine(
          (value) => value.pan !== undefined || value.tilt !== undefined,
          {
            message: "Give a value for pan, tilt or both.",
          },
        ),
    })
    .strict(),
  label: () => "Change Aim",
  coalesceKey: ({ pan, tilt }) => `aim.edit:${pan}:${tilt}`,
  apply({ document, payload }): CommandOutcome {
    const patches: Patch[] = [];
    for (const axis of ["pan", "tilt"] as const) {
      const value = payload.value[axis];
      if (value === undefined) continue;
      const address = payload[axis];
      const resolved = resolveAddress(document, address);
      if (resolved !== undefined && resolved.type !== "number")
        return rejected(`Address “${address}” is not a number.`);
      const written = writeAddress(document, address, value);
      if (!written.ok) return rejected(written.error);
      patches.push(...written.patches);
    }
    return accepted(patches);
  },
});
