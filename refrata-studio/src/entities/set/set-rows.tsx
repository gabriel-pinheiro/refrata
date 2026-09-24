import type { DocumentView } from "@refrata/client";
import {
  childSets,
  isRuleSet,
  setMembers,
  type FixtureSet,
  type MemberSet,
  type Table,
} from "@refrata/core";
import { Trash2, Ungroup } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useCommand, useDocumentPath, useSignal } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import {
  NavigatorEmptyRow,
  NavigatorRow,
  type CreateItem,
} from "@/navigator/navigator-row";
import { SortableItem, SortableList } from "@/navigator/sortable";
import {
  isSelected,
  pickModeOf,
  soleId,
  useSelection,
} from "@/selection/selection";

import { ruleSetIcon, setIcons } from "./set-icons";

/** The Sets under the root or one Group as rows; a selected Set has its members outlined in the Rig View. */
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
  const { selected, select } = useSelection();
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
      selectedId={soleId(selected, "set")}
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
                  id={set.id}
                  icon={
                    set.kind === "set" && isRuleSet(set)
                      ? ruleSetIcon
                      : setIcons[set.kind]
                  }
                  label={set.name}
                  depth={depth}
                  selected={isSelected(selected, "set", set.id)}
                  expanded={expanded}
                  onToggle={
                    group
                      ? (next) => setExpanded("set", set.id, next)
                      : undefined
                  }
                  onSelect={(event) =>
                    select({ kind: "set", id: set.id }, pickModeOf(event))
                  }
                  createItems={group ? createItems(set.id) : undefined}
                >
                  {set.kind === "set" && <MemberCount view={view} set={set} />}
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

/** How many members a Set has now; a Set by rule follows the Rig, so only it reads the whole document. */
function MemberCount({
  view,
  set,
}: {
  readonly view: DocumentView;
  readonly set: MemberSet;
}) {
  return (
    <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
      {isRuleSet(set) ? (
        <RuleMemberCount view={view} set={set} />
      ) : (
        String(set.members.length)
      )}
    </span>
  );
}

function RuleMemberCount({
  view,
  set,
}: {
  readonly view: DocumentView;
  readonly set: MemberSet;
}) {
  const document = useSignal(view.document);
  return document === undefined
    ? null
    : String(setMembers(document, set).length);
}
