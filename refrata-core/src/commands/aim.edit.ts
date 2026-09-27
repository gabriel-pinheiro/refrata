import { z } from "zod";

import { resolveAddress } from "../address/address.ts";
import { writeAddress } from "../address/write.ts";
import {
  accepted,
  defineCommand,
  rejected,
  type CommandOutcome,
} from "../command/command.ts";
import {
  addressReach,
  clampWithin,
  reachLimits,
} from "../composition/row-reach.ts";
import { getAtPath, type Patch } from "../document/patch.ts";
import { settings } from "../settings.ts";

/**
 * The authoring write of an Aim: the `pan` and `tilt` Addresses of one
 * owner, either or both, as one undoable step. Each value is first held to
 * the widest range the Elements its row reaches cover together
 * (`clampWithin`, with a warning naming the value asked), so no caller can
 * store an Aim no fixture can take; then each axis follows the rule of
 * `address.edit`, so a linked axis refuses and nothing is written. The step
 * coalesces per pair of Addresses whichever axes each write moves, so a
 * held arrow key or a drag on the pad undoes as one.
 */
export const aimEdit = defineCommand({
  name: "aim.edit",
  kind: "authoring",
  description:
    "Edit an Aim as one undoable step: pan and tilt name the two number Addresses, such as layer/<id>/row/all/pan and layer/<id>/row/all/tilt, and value holds the degrees for either or both. A value beyond the widest range the Elements the row reaches cover is clamped to it, with a warning.",
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
    const warnings: string[] = [];
    for (const axis of ["pan", "tilt"] as const) {
      const asked = payload.value[axis];
      if (asked === undefined) continue;
      const address = payload[axis];
      const resolved = resolveAddress(document, address);
      if (resolved !== undefined && resolved.type !== "number")
        return rejected(`Address “${address}” is not a number.`);
      let value = asked;
      if (resolved?.range !== undefined) {
        const current = getAtPath(document, resolved.path);
        value = clampWithin(
          asked,
          typeof current === "number" ? current : undefined,
          reachLimits(addressReach(document, address), resolved.range),
        );
        if (value !== asked) {
          const unit = resolved.range.unit ?? "";
          const shown = (degrees: number): string =>
            `${degrees.toFixed(settings.aim.decimals)}${unit}`;
          warnings.push(
            `${resolved.label} clamped to ${shown(value)} from ${shown(asked)}: the Elements it reaches go no further.`,
          );
        }
      }
      const written = writeAddress(document, address, value);
      if (!written.ok) return rejected(written.error);
      patches.push(...written.patches);
    }
    return accepted(
      patches,
      undefined,
      warnings.length === 0 ? undefined : warnings,
    );
  },
});
