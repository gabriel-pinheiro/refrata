import { z } from "zod";

import { linksUnder } from "../address/links.ts";
import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { Patch } from "../document/patch.ts";
import { regionPlacePrefix } from "../document/region.ts";
import { defaultBinding, isRegionSlot } from "../document/visual-layers.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import { notLayerOf } from "./kind-problems.ts";

/**
 * Takes the Region off a Visual Layer: the Slots that ran along it go back
 * to Slot Bindings, each at its Visual's default, so one of them can reach
 * another Attribute or none. The Links on the Region's Aims go with it.
 */
export const layerRegionRemove = defineCommand({
  name: "layer.region.remove",
  kind: "authoring",
  description:
    "Remove the Region of a Visual Layer; the Slots that ran along it take their default bindings, and the Links on its Aims go.",
  payload: z.object({ layerId: z.string().min(1) }).strict(),
  label: () => "Remove Region",
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (layer?.kind !== "visual")
      return rejected(notLayerOf(document, payload.layerId, "visual"));
    if (layer.region === undefined)
      return rejected(`“${layer.name}” has no Region.`);
    const definition = visualDefinition(layer.visual);
    const patches: Patch[] = [
      { op: "remove", path: ["layers", layer.id, "region"] },
    ];
    for (const slot of definition?.slots ?? [])
      if (isRegionSlot(definition, slot.key))
        patches.push({
          op: "set",
          path: ["layers", layer.id, "bindings", slot.key],
          value: defaultBinding(slot),
        });
    const links = linksUnder(document.links, regionPlacePrefix(layer.id));
    for (const link of links)
      patches.push({ op: "remove", path: ["links", link.id] });
    return accepted(
      patches,
      undefined,
      links.length === 0
        ? undefined
        : [
            `Removed ${String(links.length)} Link${links.length === 1 ? "" : "s"}`,
          ],
    );
  },
});
