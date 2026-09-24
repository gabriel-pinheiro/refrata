import { LAYER_LABELS, type LayerKind } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import { targetLabel, type TargetSource } from "../document/targets.ts";

/**
 * Why `id` is not a Layer of the kind a command needs, said with the
 * Layer's name and what it is instead ("targeted" is a Look or Visual
 * Layer, the kinds with Targets).
 */
export function notLayerOf(
  document: Pick<Document, "layers">,
  id: string,
  wanted: LayerKind | "targeted",
): string {
  const layer = document.layers[id];
  if (layer === undefined) return `No Layer “${id}”.`;
  if (wanted === "targeted")
    return `“${layer.name}” is a ${LAYER_LABELS[layer.kind]}; it has no Targets.`;
  return `“${layer.name}” is a ${LAYER_LABELS[layer.kind]}, not a ${LAYER_LABELS[wanted]}.`;
}

/** Why `id` is not a Fixture Set: none by that id, or a Group of them. */
export function notFixtureSet(
  document: Pick<Document, "fixtureSets">,
  id: string,
): string {
  const set = document.fixtureSets[id];
  if (set === undefined) return `No Fixture Set “${id}”.`;
  return `“${set.name}” is a Group, not a Fixture Set.`;
}

/** "“Par › Panel 1” is not a Target of “Base”.": a Target ref said as its label. */
export function notTargetOf(
  document: TargetSource,
  ref: string,
  layerName: string,
): string {
  return `“${targetLabel(document, ref)}” is not a Target of “${layerName}”.`;
}

/** "“Par › Panel 1” is not a member of “Wall”.": a member ref said as its label. */
export function notMemberOf(
  document: TargetSource,
  ref: string,
  setName: string,
): string {
  return `“${targetLabel(document, ref)}” is not a member of “${setName}”.`;
}
