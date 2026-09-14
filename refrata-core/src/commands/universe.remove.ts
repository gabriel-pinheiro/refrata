import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { tableEntries } from "../document/document.ts";
import { patchedIn } from "../document/fixtures.ts";
import type { Patch } from "../document/patch.ts";

/** Removing a Universe unpatches the Fixtures in it (they stay) and removes its Outputs, and says so. */
export const universeRemove = defineCommand({
  name: "universe.remove",
  kind: "authoring",
  description:
    "Remove a Universe; Fixtures patched in it become unpatched and its Outputs go.",
  payload: z.object({ universeId: z.string().min(1) }).strict(),
  label: () => "Remove Universe",
  apply({ document, payload }) {
    const universe = document.universes[payload.universeId];
    if (universe === undefined)
      return rejected(`Universe “${payload.universeId}” does not exist.`);
    const patches: Patch[] = [];
    const warnings: string[] = [];
    const unpatched = patchedIn(document, universe.id);
    for (const fixture of unpatched)
      patches.push({
        op: "set",
        path: ["fixtures", fixture.id, "patch"],
        value: null,
      });
    if (unpatched.length > 0)
      warnings.push(
        `Unpatched ${unpatched.length} Fixture${unpatched.length === 1 ? "" : "s"} from ${universe.name}`,
      );
    const outputs = tableEntries(document.outputs).filter(
      (output) => output.universeId === universe.id,
    );
    for (const output of outputs)
      patches.push({ op: "remove", path: ["outputs", output.id] });
    if (outputs.length > 0)
      warnings.push(
        `Removed ${outputs.length} Output${outputs.length === 1 ? "" : "s"}`,
      );
    patches.push({ op: "remove", path: ["universes", universe.id] });
    return accepted(patches, undefined, warnings);
  },
});
