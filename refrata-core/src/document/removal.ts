import type { Document } from "./document.ts";
import type { Patch } from "./patch.ts";

/**
 * What a removal took with it besides the entity: one line for the Links
 * released and one for the Macro actions dropped, counted from the patches
 * (a removed `links/<id>`; a Macro's `actions` set to a shorter list).
 */
export function removalWarnings(
  document: Document,
  patches: readonly Patch[],
  name: string,
  extra: readonly string[] = [],
): string[] {
  const links = patches.filter(
    (patch) => patch.op === "remove" && patch.path[0] === "links",
  ).length;
  let actions = 0;
  for (const patch of patches) {
    if (patch.op !== "set" || patch.path[0] !== "macros") continue;
    if (patch.path[2] !== "actions") continue;
    const macro = document.macros[String(patch.path[1])];
    if (macro?.kind !== "macro") continue;
    actions += macro.actions.length - (patch.value as unknown[]).length;
  }
  const warnings: string[] = [...extra];
  if (actions > 0)
    warnings.push(
      `Removed ${actions} Macro action${actions === 1 ? "" : "s"} targeting “${name}”`,
    );
  if (links > 0)
    warnings.push(`Removed ${links} Link${links === 1 ? "" : "s"}`);
  return warnings;
}
