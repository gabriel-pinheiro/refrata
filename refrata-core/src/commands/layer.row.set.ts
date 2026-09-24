import { z } from "zod";

import { linkAt } from "../address/links.ts";
import { accepted, defineCommand, rejected } from "../command/command.ts";
import { rowAddress } from "../composition/contributions.ts";
import type { LookRow } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import {
  hasRowRef,
  rowPath,
  rowRefAttributes,
  rowRefDefinition,
  rowRefLabel,
  rowRefStart,
  storedRow,
} from "../document/look-rows.ts";
import type { Patch } from "../document/patch.ts";
import { ParameterValueSchema, validateParameterValue } from "../parameters.ts";
import { ATTRIBUTES, isAttributeKey } from "../rig/attributes.ts";

function controlledBy(document: Document, address: string): string | undefined {
  const link = linkAt(document, address);
  return link === undefined
    ? undefined
    : (document.controllers[link.controllerId]?.name ?? "a Controller");
}

/**
 * Sets one Attribute's row on one or more row refs of a Look Layer: a
 * Target, or `ALL_TARGETS_REF` for the "All Targets" row every Target takes
 * unless its own row overrides it. The value, the alpha, or both; a row
 * that did not exist starts at alpha 1 and the Element's Highlight for the
 * Attribute when its Mode declares one, else the Parameter's Default, so
 * ticking an Attribute on is this command with neither and lights the
 * fixture. A Set row can name any Attribute of the vocabulary, since a rule
 * Set's members may arrive later. A row a Controller drives refuses the
 * hand edit, as every Address does.
 */
export const layerRowSet = defineCommand({
  name: "layer.row.set",
  kind: "authoring",
  description:
    "Set a Look Layer row: an Attribute's value on one or more Targets, or on All Targets.",
  payload: z
    .object({
      layerId: z.string().min(1),
      targets: z.array(z.string().min(1)).min(1),
      attribute: z.string().min(1),
      value: ParameterValueSchema.optional(),
      alpha: z.number().min(0).max(1).optional(),
    })
    .strict(),
  label: ({ attribute }) =>
    `Set ${isAttributeKey(attribute) ? ATTRIBUTES[attribute].label : attribute}`,
  coalesceKey: ({ layerId, targets, attribute, value, alpha }) =>
    `layer.row.set:${layerId}:${[...targets].sort().join(",")}:${attribute}:${value === undefined ? "" : "v"}${alpha === undefined ? "" : "a"}`,
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (layer?.kind !== "look")
      return rejected(`“${payload.layerId}” is not a Look Layer.`);
    const attribute = payload.attribute;
    if (!isAttributeKey(attribute))
      return rejected(`“${attribute}” is not an Attribute.`);
    const patches: Patch[] = [];
    for (const ref of new Set(payload.targets)) {
      if (!hasRowRef(layer, ref))
        return rejected(`“${ref}” is not a Target of ${layer.name}.`);
      if (!rowRefAttributes(document, layer, ref).includes(attribute))
        return rejected(
          `${rowRefLabel(document, ref)} has no ${ATTRIBUTES[attribute].label}.`,
        );
      const definition = rowRefDefinition(document, ref, attribute);
      const existing = storedRow(layer, ref, attribute);
      if (payload.value !== undefined) {
        const problem = validateParameterValue(definition, payload.value);
        if (problem !== undefined)
          return rejected(`${definition.label} ${problem}.`);
        const owner = controlledBy(
          document,
          rowAddress(layer.id, ref, attribute),
        );
        if (owner !== undefined)
          return rejected(`${definition.label} is controlled by ${owner}.`);
      }
      const row: LookRow = {
        value:
          payload.value ??
          existing?.value ??
          rowRefStart(document, ref, attribute),
        alpha: payload.alpha ?? existing?.alpha ?? 1,
      };
      if (
        existing !== undefined &&
        (existing.alpha ?? 1) === row.alpha &&
        JSON.stringify(existing.value) === JSON.stringify(row.value)
      )
        continue;
      patches.push({
        op: "set",
        path: rowPath(layer.id, ref, attribute),
        value: row,
      });
    }
    return accepted(patches);
  },
});
