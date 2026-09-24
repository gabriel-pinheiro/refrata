import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { FrameSchema, type Frame } from "../document/composition.ts";
import { frameFittingTargets } from "../document/geometry.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import { notLayerOf } from "./kind-problems.ts";

/**
 * Sets the Frame of a Visual Layer running a Geometry Visual: the fields
 * given replace the Frame's (what a drag of the Frame in the Rig View and
 * its inspector fields send), or `fit` puts it around the Layer's Targets
 * again. A drag undoes as one step. A Layer of any other Visual has no
 * Frame and refuses.
 */
export const layerFrameSet = defineCommand({
  name: "layer.frame.set",
  kind: "authoring",
  description:
    "Set the Frame of a Layer running a Geometry Visual: x, y, width, height in metres and rotation in degrees, fields left out keeping their value; or fit it to the Layer's Targets.",
  payload: z
    .object({
      layerId: z.string().min(1),
      frame: FrameSchema.partial().optional(),
      /** Fit the Frame around the Layer's Targets instead; wins over `frame`. */
      fit: z.boolean().optional(),
    })
    .strict(),
  label: ({ fit }) => (fit === true ? "Fit Frame to Targets" : "Set Frame"),
  coalesceKey: ({ layerId, fit }) =>
    fit === true ? undefined : `layer.frame.set:${layerId}`,
  apply({ document, payload }) {
    const layer = document.layers[payload.layerId];
    if (layer?.kind !== "visual")
      return rejected(notLayerOf(document, payload.layerId, "visual"));
    const definition = visualDefinition(layer.visual);
    if (definition?.geometry === undefined)
      return rejected(
        `${layer.name} runs ${definition?.name ?? `“${layer.visual}”`}, which is not a Geometry Visual, so it has no Frame.`,
      );
    const current = layer.frame ?? frameFittingTargets(document, layer);
    let frame: Frame;
    if (payload.fit === true) frame = frameFittingTargets(document, layer);
    else {
      frame = { ...current };
      for (const [field, value] of Object.entries(payload.frame ?? {})) {
        if (typeof value !== "number" || !Number.isFinite(value))
          return rejected(`Frame ${field} must be a finite number.`);
        frame[field as keyof Frame] = value;
      }
    }
    if (
      layer.frame !== undefined &&
      (Object.keys(frame) as (keyof Frame)[]).every(
        (field) => layer.frame?.[field] === frame[field],
      )
    )
      return accepted([]);
    return accepted([
      { op: "set", path: ["layers", layer.id, "frame"], value: frame },
    ]);
  },
});
