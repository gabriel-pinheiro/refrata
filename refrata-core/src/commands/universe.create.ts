import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { uniqueName } from "../document/names.ts";
import { orderedEntries } from "../document/order.ts";
import type { Universe } from "../document/rig.ts";
import { orderKeyForNew } from "../document/tree.ts";
import { generateId, id } from "../ids.ts";

/** A new Universe lands last, or right after the sibling `after` names, named `Universe N` unless told otherwise. */
export const universeCreate = defineCommand({
  name: "universe.create",
  kind: "authoring",
  description: "Add a Universe: a named bank of 512 DMX Addresses.",
  payload: z
    .object({
      id: z.string().min(1).optional(),
      name: z.string().trim().min(1).max(120).optional(),
      /** Universe to land after; absent for last, null for first. */
      after: z.string().min(1).nullable().optional(),
    })
    .strict(),
  label: () => "Add Universe",
  apply({ document, payload }) {
    const universeId =
      payload.id === undefined
        ? generateId("universe")
        : id("universe", payload.id);
    if (universeId in document.universes)
      return rejected(`Universe “${universeId}” already exists.`);
    const siblings = orderedEntries(document.universes);
    const after =
      payload.after === undefined
        ? (siblings.at(-1)?.id ?? null)
        : payload.after;
    const order = orderKeyForNew(siblings, after, "Universe");
    if (typeof order !== "string") return rejected(order.error);
    const universe: Universe = {
      id: universeId,
      name: uniqueName(
        siblings.map((sibling) => sibling.name),
        payload.name ?? `Universe ${siblings.length + 1}`,
      ),
      order,
    };
    return accepted([
      { op: "set", path: ["universes", universeId], value: universe },
    ]);
  },
});
