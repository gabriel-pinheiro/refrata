import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { testerHolds, testerPatch } from "../rig/tester.ts";

/**
 * Sets held channels of the DMX Tester by absolute channel number: a byte,
 * or null to release that channel so the frame underneath shows through
 * it. Show control, never saved.
 */
export const testerSet = defineCommand({
  name: "tester.set",
  kind: "performance",
  description:
    "Set DMX Tester channels to bytes, or to null to release them one by one.",
  payload: z
    .object({
      values: z.record(
        z.string().regex(/^\d+$/),
        z.number().int().min(0).max(255).nullable(),
      ),
    })
    .strict(),
  apply({ document, payload }) {
    const tester = document.operational.tester;
    if (tester === null) return rejected("The DMX Tester holds no range.");
    const values = [...tester.values];
    let changed = false;
    for (const [key, value] of Object.entries(payload.values)) {
      const channel = Number(key);
      if (!testerHolds(tester, channel))
        return rejected(
          `Channel ${String(channel)} is outside the held range ${String(tester.address)} to ${String(tester.address + tester.values.length - 1)}.`,
        );
      const index = channel - tester.address;
      if (values[index] === value) continue;
      values[index] = value;
      changed = true;
    }
    return accepted(changed ? [testerPatch({ ...tester, values })] : []);
  },
});

/** Every held channel to 0: the probe's rest state. */
export const testerZero = defineCommand({
  name: "tester.zero",
  kind: "performance",
  description: "Set every DMX Tester channel to 0.",
  payload: z.object({}).strict(),
  apply({ document }) {
    const tester = document.operational.tester;
    if (tester === null) return rejected("The DMX Tester holds no range.");
    if (tester.values.every((value) => value === 0)) return accepted([]);
    return accepted([
      testerPatch({ ...tester, values: tester.values.map(() => 0) }),
    ]);
  },
});

/** Releases the whole range, so the tester holds nothing. */
export const testerRelease = defineCommand({
  name: "tester.release",
  kind: "performance",
  description: "Release the DMX Tester's range.",
  payload: z.object({}).strict(),
  apply({ document }) {
    if (document.operational.tester === null) return accepted([]);
    return accepted([testerPatch(null)]);
  },
});
