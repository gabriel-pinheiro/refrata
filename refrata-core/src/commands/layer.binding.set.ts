import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import type { SlotBinding } from "../document/composition.ts";
import {
  bindingProblem,
  defaultBinding,
  isRegionSlot,
} from "../document/visual-layers.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import { notLayerOf } from "./kind-problems.ts";

/**
 * Binds one Slot of a Visual Layer to an Attribute, or to none. A number
 * Slot takes two anchors in the Attribute's units; left out, they stay as
 * they are when the Attribute does not change and become the Attribute's
 * whole range when it does. A Slot that runs along the Layer's Region has
 * no binding while the Region is there.
 */
export const layerBindingSet = defineCommand({
  name: "layer.binding.set",
  kind: "authoring",
  description:
    "Bind a Slot of a Visual Layer to an Attribute (null for none), with the range a number Slot's 0 and 1 map onto.",
  payload: z
    .object({
      layerId: z.string().min(1),
      slot: z.string().min(1),
      attribute: z.string().min(1).nullable(),
      from: z.number().optional(),
      to: z.number().optional(),
    })
    .strict(),
  label: ({ attribute }) => (attribute === null ? "Unbind Slot" : "Bind Slot"),
  coalesceKey: ({ layerId, slot, attribute }) =>
    `layer.binding.set:${layerId}:${slot}:${attribute ?? ""}`,
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (layer?.kind !== "visual")
      return rejected(notLayerOf(document, payload.layerId, "visual"));
    const definition = visualDefinition(layer.visual);
    const slot = definition?.slots.find(
      (candidate) => candidate.key === payload.slot,
    );
    if (slot === undefined)
      return rejected(`${layer.name} has no Slot “${payload.slot}”.`);
    if (layer.region !== undefined && isRegionSlot(definition, slot.key))
      return rejected(
        `${slot.label} runs along the Region of “${layer.name}”. Set the Region, or remove it to bind the Slot.`,
      );
    const current = layer.bindings[slot.key];
    const base: SlotBinding =
      current?.attribute === payload.attribute
        ? current
        : defaultBinding(slot, payload.attribute);
    const binding: SlotBinding = {
      ...base,
      ...(payload.from === undefined ? {} : { from: payload.from }),
      ...(payload.to === undefined ? {} : { to: payload.to }),
    };
    const problem = bindingProblem(slot, binding);
    if (problem !== undefined) return rejected(problem);
    return accepted([
      {
        op: "set",
        path: ["layers", layer.id, "bindings", slot.key],
        value: binding,
      },
    ]);
  },
});
