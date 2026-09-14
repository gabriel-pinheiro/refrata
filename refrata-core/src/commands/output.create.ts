import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { ANY_DEVICE, OUTPUT_KINDS, type Output } from "../document/rig.ts";
import { generateId, id } from "../ids.ts";

/** An Output delivers one Universe through a serial DMX widget, named by serial number or `any`. */
export const outputCreate = defineCommand({
  name: "output.create",
  kind: "authoring",
  description:
    "Add an Output delivering a Universe through an Enttec-compatible USB widget.",
  payload: z
    .object({
      id: z.string().min(1).optional(),
      universeId: z.string().min(1),
      kind: z.enum(OUTPUT_KINDS),
      /** FTDI serial number of the widget, or `any` for the first one found. */
      device: z.string().trim().min(1).default(ANY_DEVICE),
    })
    .strict(),
  label: () => "Add Output",
  apply({ document, payload }) {
    const outputId =
      payload.id === undefined
        ? generateId("output")
        : id("output", payload.id);
    if (outputId in document.outputs)
      return rejected(`Output “${outputId}” already exists.`);
    if (!(payload.universeId in document.universes))
      return rejected(`Universe “${payload.universeId}” does not exist.`);
    const output: Output = {
      id: outputId,
      universeId: payload.universeId,
      kind: payload.kind,
      device: payload.device,
    };
    return accepted([
      { op: "set", path: ["outputs", outputId], value: output },
    ]);
  },
});
