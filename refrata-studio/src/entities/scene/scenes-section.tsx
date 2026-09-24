import type { DocumentView } from "@refrata/client";
import {
  generateId,
  orderedEntries,
  type Layer,
  type Scene,
  type Table,
} from "@refrata/core";
import { Clapperboard, Copy, Play, Trash2 } from "lucide-react";
import { useState } from "react";

import { NameDialog } from "@/components/name-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { LayerRows } from "@/entities/layer/layer-rows";
import { countLayerWarnings } from "@/entities/layer/layer-warning";
import { useLayerActions } from "@/entities/layer/use-layer-actions";
import { macroIcons } from "@/entities/macro/macro-icons";
import { useMakeMacro } from "@/entities/macro/use-make-macro";
import { useCommand, useDocumentPath } from "@/lib/client";
import { useExpansion } from "@/navigator/expansion";
import { NavigatorRow, RowAction } from "@/navigator/navigator-row";
import { NavigatorSection } from "@/navigator/navigator-section";
import { SortableItem, SortableList } from "@/navigator/sortable";
import { useRemoveEntities } from "@/selection/remove-selection";
import {
  isSelected,
  pickModeOf,
  soleId,
  useSelection,
} from "@/selection/selection";

const MacroIcon = macroIcons.macro;

/**
 * Navigator section listing the Scenes, each opening to its Layer stack. The
 * active Scene carries a green dot; Play cuts the Outputs to a Scene without
 * selecting it, and selecting a Scene never plays it.
 */
export function ScenesSection({ view }: { readonly view: DocumentView }) {
  const command = useCommand(view);
  const { selected, select } = useSelection();
  const removeEntities = useRemoveEntities();
  const { isExpanded, setExpanded } = useExpansion();
  const { createItems, dialog } = useLayerActions(view);
  const scenes = useDocumentPath<Table<Scene>>(view, ["scenes"]) ?? {};
  const layers = useDocumentPath<Table<Layer>>(view, ["layers"]) ?? {};
  const activeScene = useDocumentPath<string | null>(view, [
    "installation",
    "activeScene",
  ]);
  const [naming, setNaming] = useState(false);
  const ordered = orderedEntries(scenes);
  const makeMacro = useMakeMacro(view);
  const play = (sceneId: string): void =>
    void command("address.trigger", { address: `scene/${sceneId}/play` });

  function create(name: string): void {
    const id = generateId("scene");
    void command("scene.create", { id, name }).then(() => {
      select({ kind: "scene", id });
    });
  }

  return (
    <>
      <NavigatorSection
        storageKey="scene"
        holds={["scene", "layer"]}
        label="Scenes"
        empty={ordered.length === 0 ? "No Scenes yet." : undefined}
        warnings={countLayerWarnings(layers)}
        onCreate={() => setNaming(true)}
      >
        <SortableList
          kind="scene"
          ids={ordered.map((scene) => scene.id)}
          selectedId={soleId(selected, "scene")}
          onMove={(sceneId, after) =>
            void command("scene.move", { sceneId, after })
          }
        >
          {ordered.map((scene) => {
            const active = scene.id === activeScene;
            const expanded = isExpanded("scene", scene.id);
            const items = createItems(scene.id, null);
            return (
              <SortableItem
                key={scene.id}
                id={scene.id}
                inside={{
                  kinds: ["layer"],
                  onDrop: (layerId) =>
                    void command("layer.move", {
                      layerId,
                      sceneId: scene.id,
                      parentId: null,
                      after: null,
                    }),
                }}
              >
                <ContextMenu>
                  <ContextMenuTrigger>
                    <NavigatorRow
                      id={scene.id}
                      icon={Clapperboard}
                      label={scene.name}
                      selected={isSelected(selected, "scene", scene.id)}
                      expanded={expanded}
                      onToggle={(next) => setExpanded("scene", scene.id, next)}
                      onSelect={(event) =>
                        select(
                          { kind: "scene", id: scene.id },
                          pickModeOf(event),
                        )
                      }
                      createItems={items}
                      actions={
                        <RowAction
                          label={`Play ${scene.name}`}
                          active={active}
                          onClick={() => play(scene.id)}
                        >
                          <Play className="size-3" />
                        </RowAction>
                      }
                    >
                      {active && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-emerald-400"
                          title="Active Scene: the Outputs show it"
                        />
                      )}
                    </NavigatorRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {items.map((item) => (
                      <ContextMenuItem key={item.label} onClick={item.onSelect}>
                        <item.icon /> Add {item.label}
                      </ContextMenuItem>
                    ))}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      disabled={active}
                      onClick={() => play(scene.id)}
                    >
                      <Play /> Play
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() =>
                        void command("scene.duplicate", { sceneId: scene.id })
                      }
                    >
                      <Copy /> Duplicate
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() =>
                        makeMacro(
                          `Play ${scene.name}`,
                          `scene/${scene.id}/play`,
                        )
                      }
                    >
                      <MacroIcon /> Make a Macro
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      disabled={active}
                      onClick={() =>
                        removeEntities([{ kind: "scene", id: scene.id }])
                      }
                    >
                      <Trash2 /> Remove
                    </ContextMenuItem>
                    {active && (
                      // A disabled item shows no tooltip, so the reason is a line of its own.
                      <p className="px-2 pb-1 text-[0.625rem] text-muted-foreground">
                        Active Scene: play another first
                      </p>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
                {expanded && (
                  <LayerRows
                    view={view}
                    sceneId={scene.id}
                    parentId={null}
                    depth={2}
                  />
                )}
              </SortableItem>
            );
          })}
        </SortableList>
      </NavigatorSection>
      {dialog}
      <NameDialog
        request={
          naming
            ? {
                title: "New Scene",
                label: "Name",
                initial: `Scene ${String(ordered.length + 1)}`,
                submitLabel: "Create",
                onSubmit: create,
              }
            : undefined
        }
        onClose={() => setNaming(false)}
      />
    </>
  );
}
