import { z } from "zod";

import { accepted, defineCommand } from "../command/command.ts";
import { settings } from "../settings.ts";

export const installationDelay = defineCommand({
  name: "installation.delay",
  kind: "authoring",
  description:
    "Set the Output Delay: how long every DMX Frame is held before the Outputs send it, in milliseconds. 0 sends at once.",
  payload: z
    .object({ ms: z.number().min(0).max(settings.output.maxDelayMs) })
    .strict(),
  label: () => "Change Output Delay",
  coalesceKey: () => "installation.delay",
  apply({ document, payload }) {
    if (document.installation.outputDelayMs === payload.ms) return accepted([]);
    return accepted([
      {
        op: "set",
        path: ["installation", "outputDelayMs"],
        value: payload.ms,
      },
    ]);
  },
});
