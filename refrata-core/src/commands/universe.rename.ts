import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { uniqueName } from "../document/names.ts";

export const universeRename = defineCommand({
  name: "universe.rename",
  kind: "authoring",
  description: "Rename a Universe.",
  payload: z
    .object({
      universeId: z.string().min(1),
      name: z.string().trim().min(1).max(120),
    })
    .strict(),
  label: () => "Rename Universe",
  coalesceKey: ({ universeId }) => `universe.rename:${universeId}`,
  apply({ document, payload }) {
    const universe = document.universes[payload.universeId];
    if (universe === undefined)
      return rejected(`Universe “${payload.universeId}” does not exist.`);
    const name = uniqueName(
      Object.values(document.universes)
        .filter((other) => other.id !== universe.id)
        .map((other) => other.name),
      payload.name,
    );
    if (name === universe.name) return accepted([]);
    return accepted([
      { op: "set", path: ["universes", universe.id, "name"], value: name },
    ]);
  },
});
