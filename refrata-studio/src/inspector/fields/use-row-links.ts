import type { DocumentView } from "@refrata/client";
import {
  generateId,
  effectiveValue,
  flattenControllers,
  isPresetLink,
  linkable,
  linkAt,
  presetLinkProblem,
  valuePresets,
  type Controller,
  type Link,
  type Preset,
  type ResolvedAddress,
  type Table,
} from "@refrata/core";

import { useCommand, useDocumentPath } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import { useSelection } from "@/selection/selection";

import type { RowLinks } from "./link-row";

/**
 * How any inspector row takes part in Parameter Links: given a resolved
 * Address and a name for a Controller or Preset made on the spot, the Link
 * it has, the Controllers and Presets it could take, and the commands
 * behind the row's menu. The value shown while a Controller drives it is
 * the effective one, read from the document as the show sees it.
 */
export function useRowLinks(
  view: DocumentView,
): (resolved: ResolvedAddress, newSourceName: string) => RowLinks {
  const command = useCommand(view);
  const { select } = useSelection();
  const { setExpanded } = useExpansion();
  const links = useDocumentPath<Table<Link>>(view, ["links"]) ?? {};
  const controllers =
    useDocumentPath<Table<Controller>>(view, ["controllers"]) ?? {};
  const presets = useDocumentPath<Table<Preset>>(view, ["presets"]) ?? {};
  const ordered = flattenControllers(controllers);
  const orderedPresets = valuePresets(presets);
  const openPreset = (presetId: string): void => {
    const parentId = presets[presetId]?.parentId ?? null;
    if (parentId !== null) setExpanded("preset", parentId, true);
    select({ kind: "preset", id: presetId });
  };
  return (resolved, newSourceName) => {
    const link = linkAt({ links }, resolved.address);
    const controller =
      link === undefined || isPresetLink(link)
        ? undefined
        : controllers[link.controllerId];
    const linkedPreset =
      link !== undefined && isPresetLink(link)
        ? presets[link.presetId]
        : undefined;
    const takesPreset = presetLinkProblem(resolved) === undefined;
    const document = view.get();
    return {
      link,
      controller,
      preset: linkedPreset?.kind === "preset" ? linkedPreset : undefined,
      effective:
        document === undefined
          ? (resolved.default ?? 0)
          : effectiveValue(document, resolved),
      candidates: ordered.filter(
        (candidate) =>
          candidate.kind !== "group" && linkable(resolved, candidate.kind),
      ),
      takesPreset,
      presets: takesPreset ? orderedPresets : [],
      onLink: (controllerId) =>
        void command("link.create", {
          controllerId,
          addresses: [resolved.address],
        }),
      onLinkPreset: (presetId) =>
        void command("link.preset", {
          presetId,
          addresses: [resolved.address],
        }),
      onCreate: (kind) => {
        const controllerId = generateId("controller");
        void command("controller.create", {
          id: controllerId,
          kind,
          name: newSourceName,
          addresses: [resolved.address],
        }).then(() => select({ kind: "controller", id: controllerId }));
      },
      onCreatePreset: () => {
        const presetId = generateId("preset");
        void command("preset.create", {
          id: presetId,
          name: newSourceName,
          addresses: [resolved.address],
        }).then(() => select({ kind: "preset", id: presetId }));
      },
      onUnlink: () => {
        if (link !== undefined)
          void command("link.remove", { linkId: link.id });
      },
      onOpen: (controllerId) =>
        select({ kind: "controller", id: controllerId }),
      onOpenPreset: openPreset,
    };
  };
}
