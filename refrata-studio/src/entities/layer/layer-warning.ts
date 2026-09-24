import type { Layer, Table } from "@refrata/core";

/** What keeps a Layer from reaching a fixture, as a navigator warning. */
export interface LayerWarning {
  readonly label: string;
  readonly explanation: string;
}

/** The words the CLI's `layers` listing prints for the same Layer. */
export const NO_TARGETS = "No Targets";

/** The one warning a Layer's row shows: a Look or Visual Layer without Targets. Groups get none. */
export function layerWarning(layer: Layer): LayerWarning | undefined {
  if (layer.kind === "group") return undefined;
  if (layer.targets.length === 0)
    return {
      label: NO_TARGETS,
      explanation:
        "This Layer reaches no fixture until Targets are added in its inspector, or a selection is added to it with Add to Layer.",
    };
  return undefined;
}

/** How many Layer rows would warn, across every Scene: what a collapsed Scenes section says. */
export function countLayerWarnings(layers: Table<Layer>): number {
  return Object.values(layers).filter(
    (layer) => layerWarning(layer) !== undefined,
  ).length;
}
