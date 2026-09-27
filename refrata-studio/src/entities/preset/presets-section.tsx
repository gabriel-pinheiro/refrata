import type { DocumentView } from "@refrata/client";
import {
  generateId,
  PRESET_KINDS,
  childPresets,
  type Preset,
  type PresetKind,
  type Table,
} from "@refrata/core";
import { useState } from "react";

import { NameDialog, type NameRequest } from "@/components/name-dialog";
import { useCommand, useDocumentPath } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import type { CreateItem } from "@/navigator/navigator-row";
import { NavigatorSection } from "@/navigator/navigator-section";
import { useSelection } from "@/selection/selection";

import { presetIcons, presetKindLabels } from "./preset-icons";
import { PresetRows } from "./preset-rows";

/**
 * Navigator section listing the Presets as a tree of Groups. A Preset
 * holds values per Element that Look Layer rows link to; Groups only
 * arrange them. Creating asks for a name, since a Preset is named for the
 * place or the look it holds ("Table Blue", "Warm White"). A Preset from
 * the current selection is made from the selection's own inspector.
 */
export function PresetsSection({ view }: { readonly view: DocumentView }) {
  const command = useCommand(view);
  const { select } = useSelection();
  const { setExpanded } = useExpansion();
  const table = useDocumentPath<Table<Preset>>(view, ["presets"]);
  const presets = table ?? {};
  const [naming, setNaming] = useState<NameRequest | undefined>(undefined);
  const roots = childPresets(presets, null);
  if (table === undefined) return null;

  function requestCreate(kind: PresetKind, parentId: string | null): void {
    const siblings = childPresets(presets, parentId);
    setNaming({
      title: `New ${presetKindLabels[kind]}`,
      label: "Name",
      initial: `${presetKindLabels[kind]} ${String(siblings.length + 1)}`,
      submitLabel: "Create",
      onSubmit: (name) => {
        const id = generateId("preset");
        void command("preset.create", { id, kind, parentId, name }).then(() => {
          if (parentId !== null) setExpanded("preset", parentId, true);
          select({ kind: "preset", id });
        });
      },
    });
  }

  const createItems = (parentId: string | null): readonly CreateItem[] =>
    PRESET_KINDS.map((kind) => ({
      label: presetKindLabels[kind],
      icon: presetIcons[kind],
      onSelect: () => requestCreate(kind, parentId),
    }));

  return (
    <>
      <NavigatorSection
        storageKey="preset"
        holds={["preset"]}
        label="Presets"
        empty={roots.length === 0 ? "No Presets yet." : undefined}
        createItems={createItems(null)}
      >
        <PresetRows
          view={view}
          parentId={null}
          depth={1}
          createItems={createItems}
        />
      </NavigatorSection>
      <NameDialog request={naming} onClose={() => setNaming(undefined)} />
    </>
  );
}
