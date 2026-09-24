import {
  ALL_TARGETS_REF,
  SET_REF_PREFIX,
  type LookLayer,
} from "../document/composition.ts";
import {
  hasRowRef,
  rowRefAttributes,
  rowRefLabel,
} from "../document/look-rows.ts";
import { targetLabel } from "../document/targets.ts";
import { elementRef } from "../rig/elements.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import type { AddressSource } from "./address.ts";

/**
 * Why an Address resolves to nothing, said so the caller can fix it: a
 * Layer's Parameter, Cue or row that the Layer does not have comes back
 * with what it does declare (a Visual's Parameters or Cues, a Look Layer's
 * Targets or a Target's Attributes) and, for a Visual, where to read them.
 */
export function unknownAddress(
  document: AddressSource,
  address: string,
): string {
  const base = `Unknown address “${address}”`;
  const [head, id = "", field, ...rest] = address.split("/");
  const layer = head === "layer" ? document.layers[id] : undefined;
  if (layer === undefined || rest.length === 0) return `${base}.`;
  if (field !== "param" && field !== "cue" && field !== "row")
    return `${base}.`;
  const named = `Layer “${layer.name}”`;
  if (layer.kind === "group")
    return `${base}: ${named} is a Group; it has no Parameters, Cues or rows.`;
  if (field === "row")
    return layer.kind === "look"
      ? `${base}: ${unknownRow(document, layer, rest)}`
      : `${base}: ${named} is a Visual Layer; it has Parameters and Cues, not rows.`;
  if (layer.kind === "look")
    return `${base}: ${named} is a Look Layer; it has rows (layer/<id|name>/row/<target|all>/<attribute>), not Parameters or Cues.`;
  const definition = visualDefinition(layer.visual);
  if (definition === undefined)
    return `${base}: Visual “${layer.visual}” is not in the Catalog.`;
  const keys =
    field === "param"
      ? Object.keys(definition.parameters)
      : definition.cues.map((cue) => cue.key);
  const noun = field === "param" ? "Parameters" : "Cues";
  const declared =
    keys.length === 0
      ? `declares no ${noun}`
      : `declares the ${noun} ${keys.join(", ")}`;
  return `${base}: ${definition.name} ${declared}. See \`refrata visuals ${definition.id}\`.`;
}

/** What is wrong with a Look Layer row Address after `row/`: its Target, or its Attribute. */
function unknownRow(
  document: AddressSource,
  layer: LookLayer,
  segments: readonly string[],
): string {
  const [first = "", second, third] = segments;
  const [ref, attribute] =
    first === ALL_TARGETS_REF || first.startsWith(SET_REF_PREFIX)
      ? [first, second]
      : [elementRef(first, second ?? ""), third];
  const named = `Layer “${layer.name}”`;
  if (!hasRowRef(layer, ref)) {
    if (layer.targets.length === 0) return `${named} has no Targets yet.`;
    const labels = layer.targets.map(
      (target) => `“${targetLabel(document, target.ref)}”`,
    );
    return `${named} has no such Target; it targets ${labels.join(", ")}, and “all” is the All Targets row.`;
  }
  if (attribute === undefined) return `a row needs an Attribute.`;
  const attributes = rowRefAttributes(document, layer, ref);
  const label = `“${rowRefLabel(document, ref)}” on ${named}`;
  return attributes.length === 0
    ? `${label} has no Attributes to hold rows for.`
    : `${label} has no Attribute “${attribute}”; it has ${attributes.join(", ")}.`;
}
