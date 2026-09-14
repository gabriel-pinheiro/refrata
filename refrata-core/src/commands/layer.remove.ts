import { z } from "zod";

import { linksUnder } from "../address/links.ts";
import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { Document } from "../document/document.ts";
import { descendantLayers } from "../document/layers.ts";
import { dropActionsUnder } from "../document/macros.ts";
import type { Patch } from "../document/patch.ts";
import { removalWarnings } from "../document/removal.ts";

/**
 * Patches dropping every Link and Macro action on an Address under one of
 * `prefixes` (`layer/<id>/`, `layer/<id>/row/<ref>/`): what goes with a
 * Layer, a Target or a row. The Links are not released onto their targets,
 * since the targets are going too.
 */
export function dropLayerReferences(
  document: Document,
  prefixes: readonly string[],
): Patch[] {
  const patches: Patch[] = [];
  for (const prefix of prefixes)
    for (const link of linksUnder(document.links, prefix))
      patches.push({ op: "remove", path: ["links", link.id] });
  patches.push(...dropActionsUnder(document, prefixes));
  return patches;
}

/** Removing a Group removes everything inside it, every Link to what goes, and every Macro action on it. */
export const layerRemove = defineCommand({
  name: "layer.remove",
  kind: "authoring",
  description: "Remove a Layer; a Group goes with its contents.",
  payload: z.object({ layerId: z.string().min(1) }).strict(),
  label: () => "Remove Layer",
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (layer === undefined)
      return rejected(`Layer “${payload.layerId}” does not exist.`);
    const going = [
      ...descendantLayers(document.layers, layer.id).map((child) => child.id),
      layer.id,
    ];
    const patches = dropLayerReferences(
      document,
      going.map((id) => `layer/${id}/`),
    );
    const warnings = removalWarnings(document, patches, layer.name);
    for (const id of going)
      patches.push({ op: "remove", path: ["layers", id] });
    return accepted(patches, undefined, warnings);
  },
});
