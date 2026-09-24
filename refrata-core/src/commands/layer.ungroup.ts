import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { childLayers } from "../document/layers.ts";
import { uniqueName } from "../document/names.ts";
import { orderKeysAfter } from "../document/order.ts";
import type { Patch } from "../document/patch.ts";
import { dropLayerReferences } from "./layer.remove.ts";
import { notLayerOf } from "./kind-problems.ts";

/**
 * Dissolves a Group: its contents take its place, in their order. The Group
 * row goes the way a removed Layer does, taking every Link to it and every
 * Macro action on it along; the contents keep theirs.
 */
export const layerUngroup = defineCommand({
  name: "layer.ungroup",
  kind: "authoring",
  description: "Replace a Layer Group by its contents.",
  payload: z.object({ layerId: z.string().min(1) }).strict(),
  label: () => "Ungroup",
  apply({ document, payload }) {
    const group = document.layers[payload.layerId];
    if (group?.kind !== "group")
      return rejected(notLayerOf(document, payload.layerId, "group"));
    const children = childLayers(document.layers, group.sceneId, group.id);
    const siblings = childLayers(
      document.layers,
      group.sceneId,
      group.parentId,
    );
    const index = siblings.findIndex((sibling) => sibling.id === group.id);
    const after = index <= 0 ? null : (siblings[index - 1]?.id ?? null);
    const others = siblings.filter((sibling) => sibling.id !== group.id);
    const keys = orderKeysAfter(others, after, children.length);
    if (keys === undefined)
      return rejected(
        "The neighbours' order keys leave no room; move them first.",
      );
    const taken = others.map((sibling) => sibling.name);
    const patches: Patch[] = dropLayerReferences(document, [
      `layer/${group.id}/`,
    ]);
    children.forEach((child, position) => {
      const name = uniqueName(taken, child.name);
      taken.push(name);
      patches.push(
        {
          op: "set",
          path: ["layers", child.id, "parentId"],
          value: group.parentId,
        },
        {
          op: "set",
          path: ["layers", child.id, "order"],
          value: keys[position] ?? child.order,
        },
      );
      if (name !== child.name)
        patches.push({
          op: "set",
          path: ["layers", child.id, "name"],
          value: name,
        });
    });
    patches.push({ op: "remove", path: ["layers", group.id] });
    return accepted(patches);
  },
});
