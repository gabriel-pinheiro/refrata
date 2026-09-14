import type { DocumentView } from "@refrata/client";
import {
  allSets,
  childSets,
  flattenStack,
  isSetRef,
  orderedEntries,
  type LookLayer,
  type MemberSet,
  type Scene,
} from "@refrata/core";
import { useState, type ReactNode } from "react";

import { NameDialog, type NameRequest } from "@/components/name-dialog";
import { useCommand, useSignal } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import { useSelection } from "@/selection/selection";

function generateSetId(): string {
  return `fixtureSet_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/** The Look Layers of one Scene, topmost first, as a menu group. */
export interface LayerChoices {
  readonly scene: Scene;
  readonly layers: readonly LookLayer[];
}

/**
 * What a selection of Fixtures, Elements and Sets can be used for: added to
 * a Look Layer as Targets, added to a Fixture Set as members (Sets cannot
 * be members), or made into a new Set. After adding, the Layer or Set is
 * selected so the inspector shows the new Targets and the Rig View outlines
 * them. Render `dialog` wherever the hook is used; it names the new Set.
 */
export function useTargetActions(view: DocumentView) {
  const command = useCommand(view);
  const document = useSignal(view.document);
  const { select } = useSelection();
  const { setExpanded } = useExpansion();
  const [naming, setNaming] = useState<NameRequest | undefined>(undefined);

  const layerChoices: readonly LayerChoices[] =
    document === undefined
      ? []
      : orderedEntries(document.scenes).map((scene) => ({
          scene,
          layers: flattenStack(document.layers, scene.id).filter(
            (layer): layer is LookLayer => layer.kind === "look",
          ),
        }));
  const setChoices: readonly MemberSet[] =
    document === undefined ? [] : allSets(document.fixtureSets);

  function addToLayer(layer: LookLayer, refs: readonly string[]): void {
    const targets = refs.filter(
      (ref) => !layer.targets.some((target) => target.ref === ref),
    );
    const done =
      targets.length === 0
        ? Promise.resolve()
        : command("layer.targets.add", { layerId: layer.id, targets }).then(
            () => undefined,
          );
    void done.then(() => {
      setExpanded("scene", layer.sceneId, true);
      if (layer.parentId !== null) setExpanded("layer", layer.parentId, true);
      select({ kind: "layer", id: layer.id });
    });
  }

  function addToSet(set: MemberSet, refs: readonly string[]): void {
    const members = refs.filter(
      (ref) => !isSetRef(ref) && !set.members.includes(ref),
    );
    const done =
      members.length === 0
        ? Promise.resolve()
        : command("set.members.add", { setId: set.id, refs: members }).then(
            () => undefined,
          );
    void done.then(() => {
      if (set.parentId !== null) setExpanded("set", set.parentId, true);
      select({ kind: "set", id: set.id });
    });
  }

  function newSet(refs: readonly string[]): void {
    const members = refs.filter((ref) => !isSetRef(ref));
    const siblings =
      document === undefined ? [] : childSets(document.fixtureSets, null);
    setNaming({
      title: "New Fixture Set from selection",
      label: "Name",
      initial: `Set ${String(siblings.length + 1)}`,
      submitLabel: "Create",
      onSubmit: (name) => {
        const id = generateSetId();
        void command("set.create", {
          id,
          kind: "set",
          parentId: null,
          name,
          members,
        }).then(() => select({ kind: "set", id }));
      },
    });
  }

  const dialog: ReactNode = (
    <NameDialog request={naming} onClose={() => setNaming(undefined)} />
  );
  return { layerChoices, setChoices, addToLayer, addToSet, newSet, dialog };
}
