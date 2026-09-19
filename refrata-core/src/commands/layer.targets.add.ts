import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { isTargetedLayer, type Target } from "../document/composition.ts";
import { targetProblem } from "../document/targets.ts";

/**
 * Appends Targets to a Look or Visual Layer, or inserts them after one of its
 * Targets. Any number at once, so "Add selection" is one undo step. A ref
 * already among the Targets is left where it is.
 */
export const layerTargetsAdd = defineCommand({
  name: "layer.targets.add",
  kind: "authoring",
  description:
    "Add Targets (Element refs <fixtureId>/<key> or Fixture Sets set:<id>) to a Layer.",
  payload: z
    .object({
      layerId: z.string().min(1),
      targets: z.array(z.string().min(1)).min(1),
      /** Target ref to insert after; null for first; absent to append. */
      after: z.string().min(1).nullable().optional(),
    })
    .strict(),
  label: ({ targets }) =>
    targets.length === 1 ? "Add Target" : `Add ${targets.length} Targets`,
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (!isTargetedLayer(layer))
      return rejected(`“${payload.layerId}” has no Targets; it is a Group.`);
    const present = new Set(layer.targets.map((target) => target.ref));
    const added: Target[] = [];
    for (const ref of new Set(payload.targets)) {
      if (present.has(ref)) continue;
      const problem = targetProblem(document, ref);
      if (problem !== undefined) return rejected(problem);
      added.push({ ref, spread: false });
    }
    if (added.length === 0) return accepted([]);
    const at =
      payload.after === undefined
        ? layer.targets.length
        : payload.after === null
          ? 0
          : layer.targets.findIndex((target) => target.ref === payload.after) +
            1;
    if (at === 0 && payload.after !== null && payload.after !== undefined)
      return rejected(`“${payload.after}” is not a Target of the Layer.`);
    const targets = [
      ...layer.targets.slice(0, at),
      ...added,
      ...layer.targets.slice(at),
    ];
    return accepted([
      { op: "set", path: ["layers", layer.id, "targets"], value: targets },
    ]);
  },
});
