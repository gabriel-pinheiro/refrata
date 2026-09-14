import type { DocumentView } from "@refrata/client";
import { childSets, type FixtureSet, type Table } from "@refrata/core";
import { Trash2, Ungroup } from "lucide-react";

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
import { isSelected, useSelection } from "@/selection/selection";

import { setIcons } from "./set-icons";

/** The Sets under the root or one Group as rows; selecting a Set picks its members. */
export function SetRows({
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
  const { selection, select, pick } = useSelection();
  const { isExpanded, setExpanded } = useExpansion();
  const sets = useDocumentPath<Table<FixtureSet>>(view, ["fixtureSets"]) ?? {};
  const rows = childSets(sets, parentId);
  const moveInto = (setId: string, target: FixtureSet): void =>
    void command("set.move", { setId, parentId: target.id, after: null });

  if (rows.length === 0)
    return (
      <NavigatorEmptyRow depth={depth}>
        {parentId === null ? "No Fixture Sets" : "Empty Group"}
      </NavigatorEmptyRow>
    );
  return (
    <SortableList
      kind="set"
      listId={`set:${parentId ?? ""}`}
      ids={rows.map((set) => set.id)}
      selectedId={selection?.kind === "set" ? selection.id : undefined}
      onMove={(setId, after) =>
        void command("set.move", { setId, parentId, after })
      }
    >
      {rows.map((set) => {
        const group = set.kind === "group";
        const expanded = group && isExpanded("set", set.id);
        return (
          <SortableItem
            key={set.id}
            id={set.id}
            inside={
              group
                ? { kinds: ["set"], onDrop: (id) => moveInto(id, set) }
                : undefined
            }
          >
            <ContextMenu>
              <ContextMenuTrigger>
                <NavigatorRow
                  icon={setIcons[set.kind]}
                  label={set.name}
                  depth={depth}
                  selected={isSelected(selection, "set", set.id)}
                  expanded={expanded}
                  onToggle={
                    group
                      ? (next) => setExpanded("set", set.id, next)
                      : undefined
                  }
                  onSelect={() => {
                    if (set.kind === "set") pick(set.members, "replace");
                    select({ kind: "set", id: set.id });
                  }}
                  createItems={group ? createItems(set.id) : undefined}
                >
                  {set.kind === "set" && (
                    <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
                      {String(set.members.length)}
                    </span>
                  )}
                </NavigatorRow>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {group && (
                  <>
                    {createItems(set.id).map((item) => (
                      <ContextMenuItem key={item.label} onClick={item.onSelect}>
                        <item.icon /> Add {item.label}
                      </ContextMenuItem>
                    ))}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() =>
                        void command("set.ungroup", { setId: set.id })
                      }
                    >
                      <Ungroup /> Ungroup
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                )}
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => void command("set.remove", { setId: set.id })}
                >
                  <Trash2 /> Remove
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            {expanded && (
              <SetRows
                view={view}
                parentId={set.id}
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
