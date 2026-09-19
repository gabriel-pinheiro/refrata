import type { DocumentView } from "@refrata/client";
import {
  generateId,
  LAYER_KINDS,
  LAYER_LABELS,
  type LayerKind,
} from "@refrata/core";
import { useState, type ReactNode } from "react";

import { useCommand, useSignal } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import type { CreateItem } from "@/navigator/navigator-row";
import { selectedTargets } from "@/selection/selected-targets";
import { useSelection } from "@/selection/selection";

import { layerIcons } from "./layer-icons";
import { VisualPicker } from "./visual-picker";

/**
 * Creating Layers from a Scene row or a Group row: one entry per kind for
 * the "+" menu and the context menu. A Visual Layer first asks which Visual
 * of the Catalog it runs. When the selection is Fixtures, Elements or Sets,
 * a new Look or Visual Layer starts with them as its Targets, so "select,
 * add Layer, set a colour" is three gestures. The new Layer is selected and
 * its parent opened. Render `dialog` wherever the hook is used; it is the
 * Catalog picker.
 */
export function useLayerActions(view: DocumentView) {
  const command = useCommand(view);
  const { selected, select } = useSelection();
  const document = useSignal(view.document);
  const { setExpanded } = useExpansion();
  const [picking, setPicking] = useState<
    { readonly sceneId: string; readonly parentId: string | null } | undefined
  >(undefined);
  const picked =
    document === undefined ? undefined : selectedTargets(document, selected);

  function create(
    kind: LayerKind,
    sceneId: string,
    parentId: string | null,
    visual?: string,
  ): void {
    if (kind === "visual" && visual === undefined) {
      setPicking({ sceneId, parentId });
      return;
    }
    const id = generateId("layer");
    void command("layer.create", {
      id,
      kind,
      sceneId,
      parentId,
      ...(visual === undefined ? {} : { visual }),
      ...(kind !== "group" && picked !== undefined ? { targets: picked } : {}),
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
        kind !== "group" && picked !== undefined
          ? `${LAYER_LABELS[kind]} on selection (${String(picked.length)})`
          : LAYER_LABELS[kind],
      icon: layerIcons[kind],
      onSelect: () => create(kind, sceneId, parentId),
    }));
  }

  const dialog: ReactNode = picking !== undefined && (
    <VisualPicker
      title="New Visual Layer"
      submitLabel="Add Visual Layer"
      onSubmit={(visual) =>
        create("visual", picking.sceneId, picking.parentId, visual)
      }
      onClose={() => setPicking(undefined)}
    />
  );

  return { create, createItems, dialog };
}
