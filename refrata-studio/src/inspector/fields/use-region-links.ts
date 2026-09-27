import type { DocumentView } from "@refrata/client";
import {
  generateId,
  isPresetLink,
  linkAt,
  valuePresets,
  type Link,
  type Preset,
  type Table,
} from "@refrata/core";

import { useCommand, useDocumentPath } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import { useSelection } from "@/selection/selection";

import type { RowLinks } from "./link-row";

/**
 * How one axis of an Aim of a Region takes part in Parameter Links: given
 * its place, its typed value and whether the Layer's Blend Mode lets a
 * Preset drive it, the Link it has, the Presets it could take and the
 * commands behind its menu. A Region is set once, so no Controller drives
 * it.
 */
export function useRegionLinks(
  view: DocumentView,
): (place: string, typed: number, takesPreset: boolean) => RowLinks {
  const command = useCommand(view);
  const { select } = useSelection();
  const { setExpanded } = useExpansion();
  const links = useDocumentPath<Table<Link>>(view, ["links"]) ?? {};
  const presets = useDocumentPath<Table<Preset>>(view, ["presets"]) ?? {};
  const ordered = valuePresets(presets);
  const openPreset = (presetId: string): void => {
    const parentId = presets[presetId]?.parentId ?? null;
    if (parentId !== null) setExpanded("preset", parentId, true);
    select({ kind: "preset", id: presetId });
  };
  return (place, typed, takesPreset) => {
    const link = linkAt({ links }, place);
    const preset =
      link !== undefined && isPresetLink(link)
        ? presets[link.presetId]
        : undefined;
    return {
      link,
      controller: undefined,
      preset: preset?.kind === "preset" ? preset : undefined,
      effective: typed,
      candidates: [],
      takesController: false,
      takesPreset,
      presets: takesPreset ? ordered : [],
      onLink: () => undefined,
      onLinkPreset: (presetId) =>
        void command("link.preset", { presetId, addresses: [place] }),
      onCreate: () => undefined,
      onCreatePreset: () => {
        const presetId = generateId("preset");
        void command("preset.create", {
          id: presetId,
          addresses: [place],
        }).then(() => select({ kind: "preset", id: presetId }));
      },
      onUnlink: () => {
        if (link !== undefined)
          void command("link.remove", { linkId: link.id });
      },
      onOpen: () => undefined,
      onOpenPreset: openPreset,
    };
  };
}
