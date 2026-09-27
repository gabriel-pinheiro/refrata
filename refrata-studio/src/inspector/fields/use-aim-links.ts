import type { DocumentView } from "@refrata/client";
import { generateId } from "@refrata/core";

import { useCommand } from "@/lib/client";
import { useSelection } from "@/selection/selection";

import type { AimPairLinks } from "./aim-link-menu";
import type { RowLinks } from "./link-row";

/**
 * How an Aim takes a Preset as a pair: given the Links of its two axes, the
 * Preset both are linked to, the
 * Presets they could take, and the commands that link, make and unlink
 * both axes in one undo step. Undefined for an Aim whose rows take no
 * Preset, such as a Preset's own.
 */
export function useAimLinks(
  view: DocumentView,
): (
  pan: { readonly address: string; readonly links: RowLinks },
  tilt: { readonly address: string; readonly links: RowLinks },
) => AimPairLinks | undefined {
  const command = useCommand(view);
  const { select } = useSelection();
  return (pan, tilt) => {
    if (!pan.links.takesPreset || !tilt.links.takesPreset) return undefined;
    const addresses = [pan.address, tilt.address];
    const shared =
      pan.links.preset !== undefined &&
      pan.links.preset.id === tilt.links.preset?.id
        ? pan.links.preset
        : undefined;
    return {
      preset: shared,
      presets: pan.links.presets,
      linked: pan.links.link !== undefined || tilt.links.link !== undefined,
      onLink: (presetId) =>
        void command("link.preset", { presetId, addresses }),
      onCreate: () => {
        const presetId = generateId("preset");
        void command("preset.create", {
          id: presetId,
          addresses,
        }).then(() => select({ kind: "preset", id: presetId }));
      },
      onUnlink: () =>
        void command("aim.unlink", { pan: pan.address, tilt: tilt.address }),
      onOpen: pan.links.onOpenPreset,
    };
  };
}
