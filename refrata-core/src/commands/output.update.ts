import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { Patch } from "../document/patch.ts";
import { OUTPUT_KINDS } from "../document/rig.ts";

export const outputUpdate = defineCommand({
  name: "output.update",
  kind: "authoring",
  description: "Change an Output's Universe, widget kind or device.",
  payload: z
    .object({
      outputId: z.string().min(1),
      universeId: z.string().min(1).optional(),
      kind: z.enum(OUTPUT_KINDS).optional(),
      device: z.string().trim().min(1).optional(),
    })
    .strict(),
  label: () => "Change Output",
  apply({ document, payload }) {
    const output = document.outputs[payload.outputId];
    if (output === undefined)
      return rejected(`Output “${payload.outputId}” does not exist.`);
    if (
      payload.universeId !== undefined &&
      !(payload.universeId in document.universes)
    )
      return rejected(`Universe “${payload.universeId}” does not exist.`);
    const patches: Patch[] = [];
    for (const field of ["universeId", "kind", "device"] as const) {
      const value = payload[field];
      if (value !== undefined && value !== output[field])
        patches.push({ op: "set", path: ["outputs", output.id, field], value });
    }
    return accepted(patches);
  },
});
