import type { DocumentView } from "@refrata/client";
import {
  OUTPUT_KINDS,
  OUTPUT_LABELS,
  orderedEntries,
  type Output,
  type OutputKind,
  type Table,
  type Universe,
} from "@refrata/core";
import type { LiveState } from "@refrata/protocol";
import { Trash2 } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useCommand, useDocumentPath } from "@/lib/client";
import { cn } from "@/lib/utils";
import { useExpansion } from "@/navigator/expansion";
import {
  NavigatorEmptyRow,
  NavigatorRow,
  type CreateItem,
} from "@/navigator/navigator-row";
import { NavigatorSection } from "@/navigator/navigator-section";
import { SortableItem, SortableList } from "@/navigator/sortable";
import { isSelected, useSelection } from "@/selection/selection";

import { outputIcons, universeIcon } from "./universe-icons";

function generateId(kind: "universe" | "output"): string {
  return `${kind}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/**
 * Navigator section listing the Universes, each opening to its Outputs with
 * a status dot. The "+" adds a Universe; a Universe row's "+" adds an
 * Output of either widget kind.
 */
export function UniversesSection({ view }: { readonly view: DocumentView }) {
  const command = useCommand(view);
  const { selection, select } = useSelection();
  const { isExpanded, setExpanded } = useExpansion();
  const table = useDocumentPath<Table<Universe>>(view, ["universes"]);
  const outputs = useDocumentPath<Table<Output>>(view, ["outputs"]) ?? {};
  const statuses =
    useDocumentPath<LiveState["outputs"]>(view, ["live", "outputs"]) ?? {};
  if (table === undefined) return null;
  const universes = orderedEntries(table);

  const addUniverse = (): void => {
    const id = generateId("universe");
    void command("universe.create", { id }).then(() =>
      select({ kind: "universe", id }),
    );
  };
  const addOutput = (universeId: string, kind: OutputKind): void => {
    const id = generateId("output");
    void command("output.create", { id, universeId, kind }).then(() => {
      setExpanded("universe", universeId, true);
      select({ kind: "output", id });
    });
  };
  const outputItems = (universeId: string): readonly CreateItem[] =>
    OUTPUT_KINDS.map((kind) => ({
      label: `Output · ${OUTPUT_LABELS[kind]}`,
      icon: outputIcons[kind],
      onSelect: () => addOutput(universeId, kind),
    }));

  return (
    <NavigatorSection
      storageKey="universe"
      label="Universes"
      empty={
        universes.length === 0 ? "No Universes. Press + to add one." : undefined
      }
      onCreate={addUniverse}
    >
      <SortableList
        kind="universe"
        ids={universes.map((universe) => universe.id)}
        selectedId={selection?.kind === "universe" ? selection.id : undefined}
        onMove={(id, after) =>
          void command("entity.move", { table: "universes", id, after })
        }
      >
        {universes.map((universe) => {
          const own = Object.values(outputs).filter(
            (output) => output.universeId === universe.id,
          );
          const expanded = isExpanded("universe", universe.id);
          return (
            <SortableItem key={universe.id} id={universe.id}>
              <ContextMenu>
                <ContextMenuTrigger>
                  <NavigatorRow
                    icon={universeIcon}
                    label={universe.name}
                    depth={1}
                    selected={isSelected(selection, "universe", universe.id)}
                    expanded={expanded}
                    onToggle={(next) =>
                      setExpanded("universe", universe.id, next)
                    }
                    onSelect={() =>
                      select({ kind: "universe", id: universe.id })
                    }
                    createItems={outputItems(universe.id)}
                  >
                    <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
                      {own.length === 0
                        ? "silent"
                        : `${String(own.length)} ${own.length === 1 ? "output" : "outputs"}`}
                    </span>
                  </NavigatorRow>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {outputItems(universe.id).map((item) => (
                    <ContextMenuItem key={item.label} onClick={item.onSelect}>
                      <item.icon /> Add {item.label}
                    </ContextMenuItem>
                  ))}
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() =>
                      void command("universe.remove", {
                        universeId: universe.id,
                      })
                    }
                  >
                    <Trash2 /> Remove
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
              {expanded &&
                (own.length === 0 ? (
                  <NavigatorEmptyRow depth={2}>No Outputs</NavigatorEmptyRow>
                ) : (
                  own.map((output) => {
                    const status = statuses[output.id];
                    return (
                      <ContextMenu key={output.id}>
                        <ContextMenuTrigger>
                          <NavigatorRow
                            icon={outputIcons[output.kind]}
                            label={`${OUTPUT_LABELS[output.kind]} · ${output.device}`}
                            depth={2}
                            selected={isSelected(
                              selection,
                              "output",
                              output.id,
                            )}
                            onSelect={() =>
                              select({ kind: "output", id: output.id })
                            }
                          >
                            <span
                              title={
                                status?.message ?? status?.state ?? "unknown"
                              }
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                status?.state === "delivering"
                                  ? "bg-emerald-400"
                                  : status?.state === "error"
                                    ? "bg-destructive"
                                    : "bg-amber-400",
                              )}
                            />
                          </NavigatorRow>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            variant="destructive"
                            onClick={() =>
                              void command("output.remove", {
                                outputId: output.id,
                              })
                            }
                          >
                            <Trash2 /> Remove
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })
                ))}
            </SortableItem>
          );
        })}
      </SortableList>
    </NavigatorSection>
  );
}
