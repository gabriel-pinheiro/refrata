import type { DocumentView } from "@refrata/client";
import {
  generateId,
  allSets,
  childPresets,
  childSets,
  flattenStack,
  isRuleSet,
  isSetRef,
  isTargetedLayer,
  orderedEntries,
  valuePresets,
  type TargetedLayer,
  type MemberSet,
  type Scene,
  type ValuePreset,
} from "@refrata/core";
import { useState, type ReactNode } from "react";

import { NameDialog, type NameRequest } from "@/components/name-dialog";
import { useCommand, useSignal } from "@/lib/client";
import { useSelection } from "@/selection/selection";

/** The Look and Visual Layers of one Scene, topmost first, as a menu group. */
export interface LayerChoices {
  readonly scene: Scene;
  readonly layers: readonly TargetedLayer[];
}

/**
 * What a selection of Fixtures, Elements and Sets can be used for: added to
 * a Look or Visual Layer as Targets, made the Targets of a new Look Layer
 * (on the playing Scene, else the first, else a new "Scene 1" that plays),
 * added to a Fixture Set by list as members (Sets cannot be members, and a
 * Set by rule takes none), made into a new Set, or added to a Preset or
 * made a new one's Elements (a Set in the selection adds the members it
 * has now). After adding, the Layer, Set or Preset is selected so the
 * inspector shows what was added and the Rig View outlines it. Render
 * `dialog` wherever the hook is used; it names the new Set or Preset.
 */
export function useTargetActions(view: DocumentView) {
  const command = useCommand(view);
  const document = useSignal(view.document);
  const { select } = useSelection();
  const [naming, setNaming] = useState<NameRequest | undefined>(undefined);

  const layerChoices: readonly LayerChoices[] =
    document === undefined
      ? []
      : orderedEntries(document.scenes).map((scene) => ({
          scene,
          layers: flattenStack(document.layers, scene.id).filter(
            isTargetedLayer,
          ),
        }));
  const setChoices: readonly MemberSet[] =
    document === undefined
      ? []
      : allSets(document.fixtureSets).filter((set) => !isRuleSet(set));

  const presetChoices: readonly ValuePreset[] =
    document === undefined ? [] : valuePresets(document.presets);

  function addToPreset(preset: ValuePreset, refs: readonly string[]): void {
    void command("preset.elements.add", { presetId: preset.id, refs }).then(
      () => select({ kind: "preset", id: preset.id }),
    );
  }

  function newPreset(refs: readonly string[]): void {
    const siblings =
      document === undefined ? [] : childPresets(document.presets, null);
    setNaming({
      title: "New Preset from selection",
      label: "Name",
      initial: `Preset ${String(siblings.length + 1)}`,
      submitLabel: "Create",
      onSubmit: (name) => {
        const id = generateId("preset");
        void command("preset.create", {
          id,
          kind: "preset",
          parentId: null,
          name,
          elements: refs,
        }).then(() => select({ kind: "preset", id }));
      },
    });
  }

  function addToLayer(layer: TargetedLayer, refs: readonly string[]): void {
    const targets = refs.filter(
      (ref) => !layer.targets.some((target) => target.ref === ref),
    );
    const done =
      targets.length === 0
        ? Promise.resolve()
        : command("layer.targets.add", { layerId: layer.id, targets }).then(
            () => undefined,
          );
    void done.then(() => select({ kind: "layer", id: layer.id }));
  }

  function newLookLayer(refs: readonly string[]): void {
    if (document === undefined) return;
    const scenes = orderedEntries(document.scenes);
    const existing =
      scenes.find((scene) => scene.id === document.installation.activeScene) ??
      scenes[0];
    const sceneId = existing?.id ?? generateId("scene");
    const ready =
      existing === undefined
        ? command("scene.create", { id: sceneId, name: "Scene 1" })
        : Promise.resolve();
    const layerId = generateId("layer");
    void ready
      .then(() =>
        command("layer.create", {
          id: layerId,
          kind: "look",
          sceneId,
          parentId: null,
          targets: refs,
        }),
      )
      .then(() => select({ kind: "layer", id: layerId }));
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
    void done.then(() => select({ kind: "set", id: set.id }));
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
        const id = generateId("fixtureSet");
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
  return {
    layerChoices,
    setChoices,
    addToLayer,
    newLookLayer,
    addToSet,
    newSet,
    presetChoices,
    addToPreset,
    newPreset,
    dialog,
  };
}
