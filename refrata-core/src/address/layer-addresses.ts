import { FADE_CURVE_LABELS, FADE_CURVES } from "../document/composition.ts";
import { orderedEntries } from "../document/order.ts";
import { settings } from "../settings.ts";
import type { AddressPattern } from "./address.ts";
import { PERCENT } from "./ranges.ts";

/**
 * The Addresses every Layer has, whatever its kind: `layer/<id>/enabled`,
 * `layer/<id>/opacity` and the four of its Layer Fade. A Visual Layer's
 * Parameters and Cues are in visual-addresses.ts, a Look Layer's rows in
 * address.ts.
 */
export const layerPatterns: readonly AddressPattern[] = [
  {
    pattern: ["layer", "*", "enabled"],
    resolve: (document, [id = ""]) => {
      const layer = document.layers[id];
      if (layer === undefined) return undefined;
      return {
        label: "Enabled",
        owner: layer.name,
        path: ["layers", id, "enabled"],
        type: "boolean",
        default: true,
      };
    },
    list: (document) =>
      orderedEntries(document.layers).map((layer) => [layer.id]),
  },
  {
    pattern: ["layer", "*", "opacity"],
    resolve: (document, [id = ""]) => {
      const layer = document.layers[id];
      if (layer === undefined) return undefined;
      return {
        label: "Opacity",
        owner: layer.name,
        path: ["layers", id, "opacity"],
        type: "number",
        default: 1,
        range: PERCENT,
      };
    },
    list: (document) =>
      orderedEntries(document.layers).map((layer) => [layer.id]),
  },
  fadePattern("in", "time"),
  fadePattern("in", "curve"),
  fadePattern("out", "time"),
  fadePattern("out", "curve"),
];

const FADE_SECONDS = {
  min: 0,
  max: settings.fade.maxSeconds,
  step: 0.01,
  unit: "s",
} as const;

/**
 * The Layer Fade Addresses of every Layer: `layer/<id>/fade/in/time`,
 * `.../in/curve`, `.../out/time` and `.../out/curve`. A time is seconds a
 * fader can ride; a curve is a choice among the fade curves.
 */
function fadePattern(
  direction: "in" | "out",
  field: "time" | "curve",
): AddressPattern {
  const property = direction === "in" ? "fadeIn" : "fadeOut";
  return {
    pattern: ["layer", "*", "fade", direction, field],
    resolve: (document, [id = ""]) => {
      const layer = document.layers[id];
      if (layer === undefined) return undefined;
      const base = {
        label: `Fade ${direction} ${field}`,
        owner: layer.name,
        path: ["layers", id, property, field] as const,
      };
      return field === "time"
        ? { ...base, type: "number", default: 0, range: FADE_SECONDS }
        : {
            ...base,
            type: "choice",
            default: "linear",
            options: FADE_CURVES.map((curve) => ({
              value: curve,
              label: FADE_CURVE_LABELS[curve],
            })),
          };
    },
    list: (document) =>
      orderedEntries(document.layers).map((layer) => [layer.id]),
  };
}
