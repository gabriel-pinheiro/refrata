import type { Document, Table } from "./document.ts";
import {
  isTargetedLayer,
  type Layer,
  type LookLayer,
  type TargetedLayer,
  type VisualLayer,
} from "./composition.ts";
import { orderedEntries } from "./order.ts";
import type { Patch } from "./patch.ts";

/**
 * A Scene's stack: the Layers with its `sceneId`, arranged as a tree of
 * Groups by `parentId` and `order`, the first sibling topmost. Groups carry
 * `enabled` only; a disabled Group hides everything inside it.
 */

/** The Layers directly under a Scene's root (`parentId` null) or a Group, topmost first. */
export function childLayers(
  layers: Table<Layer>,
  sceneId: string,
  parentId: string | null,
): readonly Layer[] {
  return orderedEntries(layers).filter(
    (layer) => layer.sceneId === sceneId && layer.parentId === parentId,
  );
}

/** Every Layer of a Scene in stack order, topmost first, Groups followed by their contents. */
export function flattenStack(
  layers: Table<Layer>,
  sceneId: string,
): readonly Layer[] {
  const result: Layer[] = [];
  const visit = (parentId: string | null): void => {
    for (const layer of childLayers(layers, sceneId, parentId)) {
      result.push(layer);
      if (layer.kind === "group") visit(layer.id);
    }
  };
  visit(null);
  return result;
}

/** Every Layer below `layerId`, topmost first; empty unless it is a Group. */
export function descendantLayers(
  layers: Table<Layer>,
  layerId: string,
): readonly Layer[] {
  const root = layers[layerId];
  if (root?.kind !== "group") return [];
  const result: Layer[] = [];
  const visit = (parent: Layer): void => {
    for (const child of childLayers(layers, parent.sceneId, parent.id)) {
      result.push(child);
      if (child.kind === "group") visit(child);
    }
  };
  visit(root);
  return result;
}

/** Every Layer of a Scene, in no particular order. */
export function sceneLayers(
  layers: Table<Layer>,
  sceneId: string,
): readonly Layer[] {
  return Object.values(layers).filter((layer) => layer.sceneId === sceneId);
}

/** Whether the Layer and every Group above it are enabled, as authored. */
export function layerEffectivelyEnabled(
  layers: Table<Layer>,
  layer: Layer,
): boolean {
  let current: Layer | undefined = layer;
  while (current !== undefined) {
    if (!current.enabled) return false;
    current = current.parentId === null ? undefined : layers[current.parentId];
  }
  return true;
}

/** The Look Layers of the whole Installation. */
export function lookLayers(layers: Table<Layer>): readonly LookLayer[] {
  return Object.values(layers).filter(
    (layer): layer is LookLayer => layer.kind === "look",
  );
}

/** The Visual Layers of one Scene, in no particular order, enabled or not. */
export function sceneVisualLayers(
  layers: Table<Layer>,
  sceneId: string,
): readonly VisualLayer[] {
  return Object.values(layers).filter(
    (layer): layer is VisualLayer =>
      layer.kind === "visual" && layer.sceneId === sceneId,
  );
}

/** Every Layer that has Targets. */
export function targetedLayers(layers: Table<Layer>): readonly TargetedLayer[] {
  return Object.values(layers).filter(isTargetedLayer);
}

/**
 * Patches dropping, from every Layer, the Targets `drop` names and
 * their rows: what the removal of a Fixture, an Element key or a Fixture
 * Set takes with it. Links and Macro actions on those rows are the caller's
 * business (see `dropRowLinks`). Returns the Targets dropped per Layer.
 */
export function dropTargets(
  document: Pick<Document, "layers">,
  drop: (ref: string) => boolean,
): { readonly patches: Patch[]; readonly dropped: Map<string, string[]> } {
  const patches: Patch[] = [];
  const dropped = new Map<string, string[]>();
  for (const layer of targetedLayers(document.layers)) {
    const going = layer.targets.filter((target) => drop(target.ref));
    const stale =
      layer.kind === "look"
        ? Object.keys(layer.rows).filter(
            (ref) => drop(ref) || !layer.targets.some((t) => t.ref === ref),
          )
        : [];
    if (going.length === 0 && stale.length === 0) continue;
    if (going.length > 0) {
      patches.push({
        op: "set",
        path: ["layers", layer.id, "targets"],
        value: layer.targets.filter((target) => !drop(target.ref)),
      });
      dropped.set(
        layer.id,
        going.map((target) => target.ref),
      );
    }
    for (const ref of stale)
      patches.push({ op: "remove", path: ["layers", layer.id, "rows", ref] });
  }
  return { patches, dropped };
}
