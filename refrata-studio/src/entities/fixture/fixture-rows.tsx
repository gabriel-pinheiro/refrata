import type { DocumentView } from "@refrata/client";
import {
  childFixtures,
  fixtureElements,
  type Fixture,
  type StoredFixtureType,
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
import { useCommand, useDocumentPath } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import {
  NavigatorEmptyRow,
  NavigatorRow,
  type CreateItem,
} from "@/navigator/navigator-row";
import { SortableItem, SortableList } from "@/navigator/sortable";
import { useRemoveEntities } from "@/selection/remove-selection";
import { TargetContextItems } from "@/entities/target/target-actions";
import {
  isSelected,
  pickModeOf,
  soleId,
  useSelection,
} from "@/selection/selection";

import { ElementRows } from "./element-rows";
import { fixtureIcons } from "./fixture-icons";

/** The Fixtures under the root or one Group as rows; a Fixture opens to its Elements, a Group to its contents. */
export function FixtureRows({
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
  const fixtures = useDocumentPath<Table<Fixture>>(view, ["fixtures"]) ?? {};
  const fixtureTypes =
    useDocumentPath<Table<StoredFixtureType>>(view, ["fixtureTypes"]) ?? {};
  const rows = childFixtures(fixtures, parentId);
  const moveInto = (fixtureId: string, target: Fixture): void =>
    void command("fixture.move", {
      fixtureId,
      parentId: target.id,
      after: null,
    });

  if (rows.length === 0)
    return (
      <NavigatorEmptyRow depth={depth}>
        {parentId === null ? "No Fixtures yet." : "Empty Group"}
      </NavigatorEmptyRow>
    );
  return (
    <SortableList
      kind="fixture"
      listId={`fixture:${parentId ?? ""}`}
      ids={rows.map((fixture) => fixture.id)}
      selectedId={soleId(selected, "fixture")}
      onMove={(fixtureId, after) =>
        void command("fixture.move", { fixtureId, parentId, after })
      }
    >
      {rows.map((fixture) => {
        const group = fixture.kind === "group";
        // A Fixture that is one Element has nothing to open to.
        const collapsible =
          group || fixtureElements({ fixtureTypes }, fixture).length !== 1;
        const expanded = collapsible && isExpanded("fixture", fixture.id);
        return (
          <SortableItem
            key={fixture.id}
            id={fixture.id}
            inside={
              group
                ? { kinds: ["fixture"], onDrop: (id) => moveInto(id, fixture) }
                : undefined
            }
          >
            <ContextMenu>
              <ContextMenuTrigger>
                <NavigatorRow
                  id={fixture.id}
                  icon={fixtureIcons[fixture.kind]}
                  label={fixture.name}
                  depth={depth}
                  selected={isSelected(selected, "fixture", fixture.id)}
                  expanded={expanded}
                  onToggle={
                    collapsible
                      ? (next) => setExpanded("fixture", fixture.id, next)
                      : undefined
                  }
                  onSelect={(event) =>
                    select(
                      { kind: "fixture", id: fixture.id },
                      pickModeOf(event),
                    )
                  }
                  createItems={group ? createItems(fixture.id) : undefined}
                >
                  {fixture.kind === "fixture" && (
                    <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
                      {fixture.patch === null
                        ? "unpatched"
                        : `@ ${String(fixture.patch.address)}`}
                    </span>
                  )}
                </NavigatorRow>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {!group && (
                  <TargetContextItems
                    view={view}
                    refs={[`${fixture.id}/root`]}
                  />
                )}
                {group && (
                  <>
                    {createItems(fixture.id).map((item) => (
                      <ContextMenuItem key={item.label} onClick={item.onSelect}>
                        <item.icon /> Add {item.label}
                      </ContextMenuItem>
                    ))}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() =>
                        void command("fixture.ungroup", {
                          fixtureId: fixture.id,
                        })
                      }
                    >
                      <Ungroup /> Ungroup
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                )}
                <ContextMenuItem
                  variant="destructive"
                  onClick={() =>
                    removeEntities([{ kind: "fixture", id: fixture.id }])
                  }
                >
                  <Trash2 /> Remove
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            {expanded && group && (
              <FixtureRows
                view={view}
                parentId={fixture.id}
                depth={depth + 1}
                createItems={createItems}
              />
            )}
            {expanded && fixture.kind === "fixture" && (
              <ElementRows view={view} fixture={fixture} depth={depth + 1} />
            )}
          </SortableItem>
        );
      })}
    </SortableList>
  );
}
