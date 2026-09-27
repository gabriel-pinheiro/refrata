import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { tableEntries } from "../document/document.ts";
import { numberedName, uniqueName } from "../document/names.ts";
import {
  PRESET_KINDS,
  PRESET_LABELS,
  type Preset,
} from "../document/preset.ts";
import { childPresets } from "../document/presets.ts";
import { orderKeyForNew } from "../document/tree.ts";
import { generateId, id } from "../ids.ts";
import { expandElements } from "./preset.elements.add.ts";
import { presetLinkPatches, seedFromRows } from "./preset-links.ts";

/**
 * A new Preset lands first at the root or in the Group it was added to, or
 * right after the sibling `after` names, listing the Elements given; with
 * no name it is "Preset 1", the next free number. "New
 * Preset from selection" is this command with the Selection as elements.
 * With `addresses` it grows out of Look Layer rows and is linked to them in
 * the same step: it lists the Elements those rows reach, each holding what
 * it shows from the row now, so nothing on the rig changes.
 */
export const presetCreate = defineCommand({
  name: "preset.create",
  kind: "authoring",
  description:
    "Add a Preset or a Group; without a name it is Preset 1, the next free number. elements lists Element refs (<fixtureId>/<key>) or Sets (set:<id>, taken as their members now); addresses are Look Layer rows, or Aims of a Region (layer/<id>/region/<aim>/<axis>), it is linked to at once, taking their Elements and what they show.",
  payload: z
    .object({
      id: z.string().min(1).optional(),
      kind: z.enum(PRESET_KINDS).default("preset"),
      /** Group to add into; null for the root. */
      parentId: z.string().min(1).nullable().default(null),
      name: z.string().trim().min(1).max(120).optional(),
      elements: z.array(z.string().min(1)).optional(),
      /** Look Layer row Addresses the new Preset drives from the start. */
      addresses: z.array(z.string().min(1)).optional(),
      /** Sibling to land after; null or absent for first. */
      after: z.string().min(1).nullable().optional(),
    })
    .strict(),
  label: ({ kind }) => `Add ${PRESET_LABELS[kind]}`,
  apply({ document, payload }) {
    const presetId =
      payload.id === undefined
        ? generateId("preset")
        : id("preset", payload.id);
    if (presetId in document.presets)
      return rejected(`Preset “${presetId}” already exists.`);
    if (payload.parentId !== null) {
      const parent = document.presets[payload.parentId];
      if (parent?.kind !== "group")
        return rejected(`“${payload.parentId}” is not a Preset Group.`);
    }
    const siblings = childPresets(document.presets, payload.parentId);
    const order = orderKeyForNew(siblings, payload.after ?? null, "Preset");
    if (typeof order !== "string") return rejected(order.error);
    const base = {
      id: presetId,
      name:
        payload.name === undefined
          ? numberedName(
              tableEntries(document.presets).map((preset) => preset.name),
              PRESET_LABELS[payload.kind],
            )
          : uniqueName(
              siblings.map((sibling) => sibling.name),
              payload.name,
            ),
      parentId: payload.parentId,
      order,
    };
    if (payload.kind === "group") {
      if (payload.elements !== undefined || payload.addresses !== undefined)
        return rejected("A Group holds Presets, not Elements or Links.");
      const group: Preset = { ...base, kind: "group" };
      return accepted([
        { op: "set", path: ["presets", presetId], value: group },
      ]);
    }
    const listed = expandElements(document, payload.elements ?? []);
    if ("error" in listed) return rejected(listed.error);
    const seed = seedFromRows(document, payload.addresses ?? []);
    if ("error" in seed) return rejected(seed.error);
    const elements = [...new Set([...listed, ...seed.elements])];
    const preset: Preset = {
      ...base,
      kind: "preset",
      elements,
      rows: Object.fromEntries(
        elements.map((ref) => [ref, seed.rows[ref] ?? {}]),
      ),
      all: {},
    };
    const created = { ...document.presets, [presetId]: preset };
    const links = presetLinkPatches(
      { ...document, presets: created },
      presetId,
      payload.addresses ?? [],
    );
    if ("error" in links) return rejected(links.error);
    return accepted([
      { op: "set", path: ["presets", presetId], value: preset },
      ...links,
    ]);
  },
});
