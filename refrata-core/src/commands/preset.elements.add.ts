import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { Document } from "../document/document.ts";
import { locateSet, memberProblem } from "../document/targets.ts";
import { setMembers } from "../document/fixture-sets.ts";
import { parseSetRef } from "../document/composition.ts";
import { notElementOf, notPreset } from "./kind-problems.ts";

/**
 * The Element refs a list of refs stands for, in order, each once: an
 * Element ref is itself and a Set (`set:<id>`) is its members as they are
 * now, since a Preset's rows are keyed by Element and never by Set.
 */
export function expandElements(
  document: Document,
  refs: readonly string[],
): string[] | { readonly error: string } {
  const elements: string[] = [];
  for (const ref of refs) {
    if (parseSetRef(ref) !== undefined) {
      const set = locateSet(document, ref);
      if (set === undefined)
        return { error: `Fixture Set “${ref}” does not exist.` };
      elements.push(...setMembers(document, set));
      continue;
    }
    const problem = memberProblem(document, ref);
    if (problem !== undefined) return { error: problem };
    elements.push(ref);
  }
  return [...new Set(elements)];
}

/** Appends Elements to a Preset, or inserts them after one of its Elements; one already there stays where it is. A Set adds its members as they are now. */
export const presetElementsAdd = defineCommand({
  name: "preset.elements.add",
  kind: "authoring",
  description:
    "Add Elements (<fixtureId>/<key>) to a Preset; a Set (set:<id>) adds its members as they are now.",
  payload: z
    .object({
      presetId: z.string().min(1),
      refs: z.array(z.string().min(1)).min(1),
      /** Element to insert after; null for first; absent to append. */
      after: z.string().min(1).nullable().optional(),
    })
    .strict(),
  label: ({ refs }) =>
    refs.length === 1 ? "Add Element" : `Add ${refs.length} Elements`,
  apply({ document, payload }) {
    const preset = document.presets[payload.presetId];
    if (preset?.kind !== "preset")
      return rejected(notPreset(document, payload.presetId));
    const expanded = expandElements(document, payload.refs);
    if ("error" in expanded) return rejected(expanded.error);
    const added = expanded.filter((ref) => !preset.elements.includes(ref));
    if (added.length === 0) return accepted([]);
    const at =
      payload.after === undefined
        ? preset.elements.length
        : payload.after === null
          ? 0
          : preset.elements.indexOf(payload.after) + 1;
    if (at === 0 && payload.after !== null && payload.after !== undefined)
      return rejected(notElementOf(document, payload.after, preset.name));
    return accepted([
      {
        op: "set",
        path: ["presets", preset.id, "elements"],
        value: [
          ...preset.elements.slice(0, at),
          ...added,
          ...preset.elements.slice(at),
        ],
      },
      ...added.map((ref) => ({
        op: "set" as const,
        path: ["presets", preset.id, "rows", ref],
        value: preset.rows[ref] ?? {},
      })),
    ]);
  },
});
