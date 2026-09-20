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
import { defaultBindings } from "../document/visual-layers.ts";
import { defaultParameterValues } from "../parameters.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import { orderKeyForNew } from "../document/tree.ts";
import { generateId, id } from "../ids.ts";

/**
 * A new Layer lands at the top of the Scene root or Group it was added to,
 * or right below the sibling `after` names. A Look Layer starts opaque,
 * blending normally, with the Targets given (or none) and no rows: every
 * Attribute released until a row is set. A Visual Layer starts the same
 * way with its Visual's default Parameter Values and default bindings; its
 * Targets arrive not spread.
 */
export const layerCreate = defineCommand({
  name: "layer.create",
  kind: "authoring",
  description:
    "Add a Look Layer, a Visual Layer running one Visual of the Catalog, or a Group to a Scene.",
  payload: z
    .object({
      id: z.string().min(1).optional(),
      kind: z.enum(LAYER_KINDS).default("look"),
      sceneId: z.string().min(1),
      /** Group to add into; null for the Scene's root. */
      parentId: z.string().min(1).nullable().default(null),
      name: z.string().trim().min(1).max(120).optional(),
      /** The Catalog id of the Visual a Visual Layer runs; required for one. */
      visual: z.string().min(1).optional(),
      /** Target refs the Layer starts with: Element refs or `set:<id>`. */
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
    const definition =
      payload.kind === "visual"
        ? visualDefinition(payload.visual ?? "")
        : undefined;
    if (payload.kind === "visual" && definition === undefined)
      return rejected(
        payload.visual === undefined
          ? "A Visual Layer needs a Visual."
          : `“${payload.visual}” is not a Visual of the Catalog.`,
      );
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
        payload.name ??
          definition?.name ??
          (payload.kind === "look" ? "Look" : "Group"),
      ),
      sceneId: payload.sceneId,
      parentId: payload.parentId,
      enabled: true,
      order,
    };
    const stack = {
      targets: targets.map((ref) => ({ ref, spread: false })),
      opacity: 1,
      blendMode: definition?.blendMode ?? "normal",
    } as const;
    const layer: Layer =
      definition !== undefined
        ? {
            ...base,
            ...stack,
            kind: "visual",
            visual: definition.id,
            parameters: { ...defaultParameterValues(definition.parameters) },
            bindings: defaultBindings(definition),
          }
        : payload.kind === "look"
          ? {
              ...base,
              ...stack,
              kind: "look",
              rows: {},
              all: {},
            }
          : { ...base, kind: "group" };
    return accepted([{ op: "set", path: ["layers", layerId], value: layer }]);
  },
});
