import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import {
  LAYER_KINDS,
  LAYER_LABELS,
  type Layer,
} from "../document/composition.ts";
import { childLayers } from "../document/layers.ts";
import { uniqueName } from "../document/names.ts";
import { targetProblem } from "../document/targets.ts";
import { orderKeyForNew } from "../document/tree.ts";
import { generateId, id } from "../ids.ts";

/**
 * A new Layer lands at the top of the Scene root or Group it was added to,
 * or right below the sibling `after` names. A Look Layer starts opaque,
 * blending normally, with the Targets given (or none) and no rows: every
 * Attribute released until a row is set.
 */
export const layerCreate = defineCommand({
  name: "layer.create",
  kind: "authoring",
  description: "Add a Look Layer or a Group to a Scene.",
  payload: z
    .object({
      id: z.string().min(1).optional(),
      kind: z.enum(LAYER_KINDS).default("look"),
      sceneId: z.string().min(1),
      /** Group to add into; null for the Scene's root. */
      parentId: z.string().min(1).nullable().default(null),
      name: z.string().trim().min(1).max(120).optional(),
      /** Target refs a Look Layer starts with: Element refs or `set:<id>`. */
      targets: z.array(z.string().min(1)).optional(),
      /** Sibling to land below; null or absent for the top. */
      after: z.string().min(1).nullable().optional(),
    })
    .strict(),
  label: ({ kind }) => `Add ${LAYER_LABELS[kind]}`,
  apply({ document, payload }) {
    const layerId =
      payload.id === undefined ? generateId("layer") : id("layer", payload.id);
    if (layerId in document.layers)
      return rejected(`Layer “${layerId}” already exists.`);
    if (!(payload.sceneId in document.scenes))
      return rejected(`Scene “${payload.sceneId}” does not exist.`);
    if (payload.parentId !== null) {
      const parent = document.layers[payload.parentId];
      if (parent?.kind !== "group" || parent.sceneId !== payload.sceneId)
        return rejected(
          `Group “${payload.parentId}” is not in Scene “${payload.sceneId}”.`,
        );
    }
    const siblings = childLayers(
      document.layers,
      payload.sceneId,
      payload.parentId,
    );
    const order = orderKeyForNew(siblings, payload.after ?? null, "Layer");
    if (typeof order !== "string") return rejected(order.error);
    const targets = [...new Set(payload.targets ?? [])];
    for (const ref of targets) {
      const problem = targetProblem(document, ref);
      if (problem !== undefined) return rejected(problem);
    }
    const base = {
      id: layerId,
      name: uniqueName(
        siblings.map((sibling) => sibling.name),
        payload.name ?? (payload.kind === "look" ? "Look" : "Group"),
      ),
      sceneId: payload.sceneId,
      parentId: payload.parentId,
      enabled: true,
      order,
    };
    const layer: Layer =
      payload.kind === "look"
        ? {
            ...base,
            kind: "look",
            targets: targets.map((ref) => ({ ref, spread: false })),
            opacity: 1,
            blendMode: "normal",
            rows: {},
          }
        : { ...base, kind: "group" };
    return accepted([{ op: "set", path: ["layers", layerId], value: layer }]);
  },
});
