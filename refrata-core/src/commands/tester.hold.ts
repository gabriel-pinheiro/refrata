import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { settings } from "../settings.ts";
import { testerPatch, testerRangeProblem } from "../rig/tester.ts";

/**
 * Holds a range of channels for the DMX Tester: every channel starts at 0
 * from this moment, so probes are never mixed with show output. Holding the
 * range already held changes nothing and counts as a touch; a different
 * range replaces it. Show control, never saved.
 */
export const testerHold = defineCommand({
  name: "tester.hold",
  kind: "performance",
  description: `Hold up to ${String(settings.tester.maxChannels)} channels of a Universe for the DMX Tester, all at 0.`,
  payload: z
    .object({
      universeId: z.string().min(1),
      address: z.number().int(),
      count: z.number().int(),
    })
    .strict(),
  apply({ document, payload }) {
    const problem = testerRangeProblem(
      document,
      payload.universeId,
      payload.address,
      payload.count,
    );
    if (problem !== undefined) return rejected(problem);
    const current = document.operational.tester;
    if (
      current !== null &&
      current.universeId === payload.universeId &&
      current.address === payload.address &&
      current.values.length === payload.count
    )
      return accepted([]);
    return accepted([
      testerPatch({
        universeId: payload.universeId,
        address: payload.address,
        values: Array.from({ length: payload.count }, () => 0),
      }),
    ]);
  },
});
