import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { isTargetedLayer } from "../document/composition.ts";
import { notLayerOf, notTargetOf } from "./kind-problems.ts";

/**
 * Sets Spread on one Target entry: on, a Set counts as its members and an
 * Element as its children, one Target each, which is what a Visual
 * distributes across. A Look Layer ignores it.
 */
export const layerTargetsSpread = defineCommand({
  name: "layer.targets.spread",
  kind: "authoring",
  description: "Turn Spread on or off for one Target of a Layer.",
  payload: z
    .object({
      layerId: z.string().min(1),
      ref: z.string().min(1),
      spread: z.boolean(),
    })
    .strict(),
  label: ({ spread }) => (spread ? "Spread Target" : "Unspread Target"),
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (!isTargetedLayer(layer))
      return rejected(notLayerOf(document, payload.layerId, "targeted"));
    const target = layer.targets.find((entry) => entry.ref === payload.ref);
    if (target === undefined)
      return rejected(notTargetOf(document, payload.ref, layer.name));
    if (target.spread === payload.spread) return accepted([]);
    return accepted([
      {
        op: "set",
        path: ["layers", layer.id, "targets"],
        value: layer.targets.map((entry) =>
          entry.ref === payload.ref
            ? { ...entry, spread: payload.spread }
            : entry,
        ),
      },
    ]);
  },
});
