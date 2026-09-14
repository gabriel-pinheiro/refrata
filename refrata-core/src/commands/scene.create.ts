import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { Scene } from "../document/composition.ts";
import { tableEntries } from "../document/document.ts";
import { uniqueName } from "../document/names.ts";
import { appendOrderKey } from "../document/order.ts";
import type { Patch } from "../document/patch.ts";
import { generateId, id } from "../ids.ts";

/** A new Scene is empty and lands last; the first Scene of an Installation becomes the active one. */
export const sceneCreate = defineCommand({
  name: "scene.create",
  kind: "authoring",
  description: "Create an empty Scene; the first one starts playing.",
  payload: z
    .object({
      id: z.string().min(1).optional(),
      name: z.string().trim().min(1).max(120).optional(),
    })
    .strict(),
  label: () => "Add Scene",
  apply({ document, payload }) {
    const sceneId =
      payload.id === undefined ? generateId("scene") : id("scene", payload.id);
    if (sceneId in document.scenes)
      return rejected(`Scene “${sceneId}” already exists.`);
    const scene: Scene = {
      id: sceneId,
      name: uniqueName(
        tableEntries(document.scenes).map((scene) => scene.name),
        payload.name ?? "Scene",
      ),
      order: appendOrderKey(document.scenes),
    };
    const patches: Patch[] = [
      { op: "set", path: ["scenes", sceneId], value: scene },
    ];
    if (document.installation.activeScene === null)
      patches.push({
        op: "set",
        path: ["installation", "activeScene"],
        value: sceneId,
      });
    return accepted(patches);
  },
});
