import type { DocumentView } from "@refrata/client";
import { childPresets, type Preset, type Table } from "@refrata/core";
import { Copy, Trash2, Ungroup } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useCommand, useDocumentPath } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import {
  NavigatorEmptyRow,
  NavigatorRow,
  type CreateItem,
} from "@/navigator/navigator-row";
import { SortableItem, SortableList } from "@/navigator/sortable";
import { useRemoveEntities } from "@/selection/remove-selection";
import {
  isSelected,
  pickModeOf,
  soleId,
  useSelection,
} from "@/selection/selection";

import { presetIcons } from "./preset-icons";

/** The Presets under the root or one Group as rows, each with its Element count at the right. */
export function PresetRows({
  view,
  parentId,
  depth,
  createItems,
}: {
  readonly view: DocumentView;
  readonly parentId: string | null;
  readonly depth: number;
  readonly createItems: (parentId: string | null) => readonly CreateItem[];
}) {
  const command = useCommand(view);
  const { selected, select } = useSelection();
  const removeEntities = useRemoveEntities();
  const { isExpanded, setExpanded } = useExpansion();
  const presets = useDocumentPath<Table<Preset>>(view, ["presets"]) ?? {};
  const rows = childPresets(presets, parentId);

  if (rows.length === 0)
    return (
      <NavigatorEmptyRow depth={depth}>
        {parentId === null ? "No Presets yet." : "Empty Group"}
      </NavigatorEmptyRow>
    );
  return (
    <SortableList
      kind="preset"
      listId={`preset:${parentId ?? ""}`}
      ids={rows.map((preset) => preset.id)}
      selectedId={soleId(selected, "preset")}
      onMove={(presetId, after) =>
        void command("preset.move", { presetId, parentId, after })
      }
    >
      {rows.map((preset) => {
        const group = preset.kind === "group";
        const expanded = group && isExpanded("preset", preset.id);
        return (
          <SortableItem
            key={preset.id}
            id={preset.id}
            inside={
              group
                ? {
                    kinds: ["preset"],
                    onDrop: (presetId) =>
                      void command("preset.move", {
                        presetId,
                        parentId: preset.id,
                        after: null,
                      }),
                  }
                : undefined
            }
          >
            <ContextMenu>
              <ContextMenuTrigger>
                <NavigatorRow
                  id={preset.id}
                  icon={presetIcons[preset.kind]}
                  label={preset.name}
                  depth={depth}
                  selected={isSelected(selected, "preset", preset.id)}
                  expanded={expanded}
                  onToggle={
                    group
                      ? (next) => setExpanded("preset", preset.id, next)
                      : undefined
                  }
                  onSelect={(event) =>
                    select({ kind: "preset", id: preset.id }, pickModeOf(event))
                  }
                  createItems={group ? createItems(preset.id) : undefined}
                >
                  {preset.kind === "preset" && (
                    <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
                      {preset.elements.length}
                    </span>
                  )}
                </NavigatorRow>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {group && (
                  <>
                    {createItems(preset.id).map((item) => (
                      <ContextMenuItem key={item.label} onClick={item.onSelect}>
                        <item.icon /> Add {item.label}
                      </ContextMenuItem>
                    ))}
                    <ContextMenuSeparator />
                  </>
                )}
                <ContextMenuItem
                  onClick={() =>
                    void command("preset.duplicate", { presetId: preset.id })
                  }
                >
                  <Copy /> Duplicate
                </ContextMenuItem>
                {group && (
                  <ContextMenuItem
                    onClick={() =>
                      void command("preset.ungroup", { presetId: preset.id })
                    }
                  >
                    <Ungroup /> Ungroup
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  onClick={() =>
                    removeEntities([{ kind: "preset", id: preset.id }])
                  }
                >
                  <Trash2 /> Remove
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            {expanded && (
              <PresetRows
                view={view}
                parentId={preset.id}
                depth={depth + 1}
                createItems={createItems}
              />
            )}
          </SortableItem>
        );
      })}
    </SortableList>
  );
}
