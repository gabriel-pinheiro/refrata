import type { DocumentView } from "@refrata/client";
import {
  expandTargets,
  spreadWarning,
  targetLabel,
  type Document,
  type TargetedLayer,
} from "@refrata/core";
import { Plus, Split, TriangleAlert, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TargetPicker } from "@/entities/target/target-picker";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { useCommand } from "@/lib/client";
import { cn } from "@/lib/utils";
import { SortableItem, SortableList } from "@/navigator/sortable";

/**
 * A Layer's Targets in order: remove, drag to reorder, "Add Targets"
 * opening the picker over the whole rig. On a Visual Layer each Target has
 * a Spread toggle saying what it expands to, since that is what the Visual
 * distributes across, and a Visual handed one Target where it wants many
 * says so with a one-click fix. A Look Layer ignores Spread and hides it.
 */
export function LayerTargets({
  view,
  document,
  layer,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: TargetedLayer;
}) {
  const command = useCommand(view);
  const [picking, setPicking] = useState(false);
  const visual = layer.kind === "visual";
  const warning = visual ? spreadWarning(document, layer) : undefined;
  const spread = (ref: string, on: boolean): void =>
    void command("layer.targets.spread", {
      layerId: layer.id,
      ref,
      spread: on,
    });
  return (
    <>
      <InspectorSection
        storageKey="targets"
        label="Targets"
        actions={
          <Button variant="ghost" size="xs" onClick={() => setPicking(true)}>
            <Plus /> Add Targets
          </Button>
        }
      >
        {layer.targets.length === 0 ? (
          <p className="text-[0.6875rem]/relaxed text-muted-foreground">
            {layer.name} reaches nothing yet. Add Targets here, or select
            Fixtures and add them to it from there.
          </p>
        ) : (
          <SortableList
            kind="layer-target"
            listId={`layer-target:${layer.id}`}
            ids={layer.targets.map((target) => target.ref)}
            selectedId={undefined}
            onMove={(target, after) =>
              void command("layer.targets.move", {
                layerId: layer.id,
                target,
                after,
              })
            }
          >
            <ol className="grid gap-px" aria-label="Targets">
              {layer.targets.map((target) => {
                const label = targetLabel(document, target.ref);
                const count = visual
                  ? expandTargets(document, [{ ...target, spread: true }])
                      .length
                  : 0;
                return (
                  <SortableItem key={target.ref} id={target.ref}>
                    <li className="flex h-6 items-center gap-1 rounded-sm pl-1 text-xs hover:bg-sidebar-accent/60">
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={target.ref}
                      >
                        {label}
                      </span>
                      {visual && (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={target.spread}
                          aria-label={`Spread ${label}`}
                          title={
                            target.spread
                              ? `Spread: the Visual sees ${targetCount(count)}. Click to hand it ${label} as one Target.`
                              : `One Target. Spread it and the Visual sees ${targetCount(count)}.`
                          }
                          className={cn(
                            "flex h-5 shrink-0 items-center gap-1 rounded-sm px-1 text-[0.625rem] tabular-nums",
                            target.spread
                              ? "bg-selection/15 text-selection"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => spread(target.ref, !target.spread)}
                        >
                          <Split className="size-3" />
                          {target.spread ? targetCount(count) : "Spread"}
                        </button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${label}`}
                        onClick={() =>
                          void command("layer.targets.remove", {
                            layerId: layer.id,
                            targets: [target.ref],
                          })
                        }
                      >
                        <X />
                      </Button>
                    </li>
                  </SortableItem>
                );
              })}
            </ol>
          </SortableList>
        )}
        {warning !== undefined && (
          <div
            className="flex items-start gap-1.5 rounded-sm bg-amber-400/10 p-1.5 text-[0.6875rem]/relaxed text-amber-300"
            data-testid="spread-warning"
          >
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            <span className="min-w-0 flex-1">{warning}</span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                for (const target of layer.targets)
                  if (!target.spread) spread(target.ref, true);
              }}
            >
              Spread it
            </Button>
          </div>
        )}
      </InspectorSection>
      {picking && (
        <TargetPicker
          view={view}
          title={`Add Targets to ${layer.name}`}
          members={false}
          taken={layer.targets.map((target) => target.ref)}
          submitLabel={(count) => `Add ${count > 0 ? String(count) : ""}`}
          onSubmit={(targets) =>
            void command("layer.targets.add", { layerId: layer.id, targets })
          }
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

const targetCount = (count: number): string =>
  `${String(count)} ${count === 1 ? "Target" : "Targets"}`;
