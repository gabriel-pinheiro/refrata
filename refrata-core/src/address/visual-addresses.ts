import { orderedEntries } from "../document/order.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import type { AddressPattern, ResolvedAddress } from "./address.ts";

/**
 * The Addresses a Visual Layer adds to those of any Layer: one per Visual
 * Parameter, resolved from the Catalog's schema so range, options and
 * default come from the Visual, and one trigger per Cue.
 */
export const visualPatterns: readonly AddressPattern[] = [
  {
    pattern: ["layer", "*", "param", "*"],
    resolve: (document, [id = "", name = ""]) => {
      const layer = document.layers[id];
      if (layer?.kind !== "visual") return undefined;
      const parameter = visualDefinition(layer.visual)?.parameters[name];
      if (parameter === undefined) return undefined;
      const base = {
        label: parameter.label,
        owner: layer.name,
        path: ["layers", id, "parameters", name] as const,
        default: parameter.default,
      };
      switch (parameter.kind) {
        case "number":
          return {
            ...base,
            type: "number",
            range: {
              min: parameter.min,
              max: parameter.max,
              ...(parameter.step === undefined ? {} : { step: parameter.step }),
              ...(parameter.unit === undefined ? {} : { unit: parameter.unit }),
              ...(parameter.percent === true ? { percent: true } : {}),
            },
          } satisfies Omit<ResolvedAddress, "address">;
        case "color":
          return { ...base, type: "color" };
        case "choice":
          return { ...base, type: "choice", options: parameter.options };
        case "boolean":
          return { ...base, type: "boolean" };
      }
    },
    list: (document) =>
      orderedEntries(document.layers).flatMap((layer) =>
        layer.kind === "visual"
          ? Object.keys(visualDefinition(layer.visual)?.parameters ?? {}).map(
              (name) => [layer.id, name],
            )
          : [],
      ),
  },
  {
    pattern: ["layer", "*", "cue", "*"],
    resolve: (document, [id = "", key = ""]) => {
      const layer = document.layers[id];
      if (layer?.kind !== "visual") return undefined;
      const cue = visualDefinition(layer.visual)?.cues.find(
        (candidate) => candidate.key === key,
      );
      if (cue === undefined) return undefined;
      return {
        label: cue.label,
        owner: layer.name,
        path: ["layers", id, "cue", key],
        type: "trigger",
      };
    },
    list: (document) =>
      orderedEntries(document.layers).flatMap((layer) =>
        layer.kind === "visual"
          ? (visualDefinition(layer.visual)?.cues ?? []).map((cue) => [
              layer.id,
              cue.key,
            ])
          : [],
      ),
  },
];
