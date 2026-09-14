import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { orderedEntries, orderKeysForMove } from "../document/order.ts";
import type { Patch } from "../document/patch.ts";

/** Places a Scene after another (or first): the order Next and Previous will follow. */
export const sceneMove = defineCommand({
  name: "scene.move",
  kind: "authoring",
  description: "Move a Scene to a new position among the Scenes.",
  payload: z
    .object({
      sceneId: z.string().min(1),
      /** Scene to land after; null for first. */
      after: z.string().min(1).nullable(),
    })
    .strict(),
  label: () => "Move Scene",
  coalesceKey: ({ sceneId }) => `scene.move:${sceneId}`,
  apply({ document, payload }) {
    const scene = document.scenes[payload.sceneId];
    if (scene === undefined)
      return rejected(`Scene “${payload.sceneId}” does not exist.`);
    if (payload.after === scene.id)
      return rejected("A Scene cannot be placed after itself.");
    if (payload.after !== null && !(payload.after in document.scenes))
      return rejected(`Scene “${payload.after}” does not exist.`);
    const siblings = orderedEntries(document.scenes).filter(
      (other) => other.id !== scene.id,
    );
    const patches: Patch[] = [
      ...orderKeysForMove(siblings, scene, payload.after),
    ].map(([id, order]) => ({
      op: "set",
      path: ["scenes", id, "order"],
      value: order,
    }));
    return accepted(patches);
  },
});
