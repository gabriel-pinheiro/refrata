import type { DocumentView } from "@refrata/client";
import { LAYER_KINDS, LAYER_LABELS, type LayerKind } from "@refrata/core";

import { useCommand } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import type { CreateItem } from "@/navigator/navigator-row";
import { useSelection } from "@/selection/selection";

import { layerIcons } from "./layer-icons";

function generateLayerId(): string {
  return `layer_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/**
 * Creating Layers from a Scene row or a Group row: one entry per kind for
 * the "+" menu and the context menu. A new Look Layer starts with the
 * picked Elements as its Targets, so "pick, add Layer, set a colour" is
 * three gestures. The new Layer is selected and its parent opened.
 */
export function useLayerActions(view: DocumentView) {
  const command = useCommand(view);
  const { select, picked } = useSelection();
  const { setExpanded } = useExpansion();

  function create(
    kind: LayerKind,
    sceneId: string,
    parentId: string | null,
  ): void {
    const id = generateLayerId();
    void command("layer.create", {
      id,
      kind,
      sceneId,
      parentId,
      ...(kind === "look" && picked.length > 0 ? { targets: picked } : {}),
    }).then(() => {
      setExpanded("scene", sceneId, true);
      if (parentId !== null) setExpanded("layer", parentId, true);
      select({ kind: "layer", id });
    });
  }

  function createItems(
    sceneId: string,
    parentId: string | null,
  ): readonly CreateItem[] {
    return LAYER_KINDS.map((kind) => ({
      label:
        kind === "look" && picked.length > 0
          ? `${LAYER_LABELS[kind]} on selection (${String(picked.length)})`
          : LAYER_LABELS[kind],
      icon: layerIcons[kind],
      onSelect: () => create(kind, sceneId, parentId),
    }));
  }

  return { create, createItems };
}
