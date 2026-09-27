import type { Document, VisualLayer } from "@refrata/core";

import { resolveId } from "../names.ts";

/** The Visual Layer `text` names, id or name, or an error saying what it is instead. */
export function visualLayer(document: Document, text: string): VisualLayer {
  const layerId = resolveId(document, "layers", text);
  const layer = document.layers[layerId];
  if (layer?.kind !== "visual")
    throw new Error(`“${layer?.name ?? text}” is not a Visual Layer.`);
  return layer;
}
