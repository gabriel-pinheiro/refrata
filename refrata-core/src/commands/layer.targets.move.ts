import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { isTargetedLayer } from "../document/composition.ts";
import { notLayerOf, notTargetOf } from "./kind-problems.ts";

/** Places a Target after another (or first): order decides which Target wins where two reach one Element. */
export const layerTargetsMove = defineCommand({
  name: "layer.targets.move",
  kind: "authoring",
  description: "Move a Target within a Look Layer's Target list.",
  payload: z
    .object({
      layerId: z.string().min(1),
      target: z.string().min(1),
      /** Target ref to land after; null for first. */
      after: z.string().min(1).nullable(),
    })
    .strict(),
  label: () => "Move Target",
  coalesceKey: ({ layerId, target }) =>
    `layer.targets.move:${layerId}:${target}`,
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (!isTargetedLayer(layer))
      return rejected(notLayerOf(document, payload.layerId, "targeted"));
    const moving = layer.targets.find((t) => t.ref === payload.target);
    if (moving === undefined)
      return rejected(notTargetOf(document, payload.target, layer.name));
    if (payload.after === payload.target)
      return rejected("A Target cannot be placed after itself.");
    const rest = layer.targets.filter((t) => t.ref !== payload.target);
    const at =
      payload.after === null
        ? 0
        : rest.findIndex((t) => t.ref === payload.after) + 1;
    if (at === 0 && payload.after !== null)
      return rejected(notTargetOf(document, payload.after, layer.name));
    const targets = [...rest.slice(0, at), moving, ...rest.slice(at)];
    if (targets.every((t, index) => t === layer.targets[index]))
      return accepted([]);
    return accepted([
      { op: "set", path: ["layers", layer.id, "targets"], value: targets },
    ]);
  },
});
