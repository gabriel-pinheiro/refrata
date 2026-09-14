import type { DocumentView } from "@refrata/client";
import { targetLabel, type Document } from "@refrata/core";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { entities, type EntityKind } from "@/entities";
import { TargetActionsSection } from "@/entities/target/target-actions";
import { useSignal } from "@/lib/client";

import { selectedTargets } from "./selected-targets";
import { selectionKey, useSelection, type Selection } from "./selection";

/**
 * What the inspector shows for several selected things: a count by kind,
 * the list in selection order with a cross to drop one, and, when every
 * item is a Fixture, an Element or a Set, what the selection can be used
 * for as Targets.
 */
export function SelectionInspector({ view }: { readonly view: DocumentView }) {
  const { selected, select } = useSelection();
  const document = useSignal(view.document);
  if (document === undefined) return null;
  const refs = selectedTargets(document, selected);
  return (
    <>
      <div className="grid gap-1 p-3">
        <h2 className="text-sm font-medium">{summary(selected)}</h2>
        <p className="text-[0.6875rem]/relaxed text-muted-foreground">
          {refs === undefined
            ? "Nothing to do with these together. Ctrl-click one to drop it, or Escape to clear."
            : "Shift-click adds, ctrl-click toggles, Escape clears."}
        </p>
      </div>
      <ol className="grid gap-px px-3 pb-3" aria-label="Selected">
        {selected.map((item) => (
          <li
            key={selectionKey(item)}
            className="flex h-6 items-center gap-1 rounded-sm pl-1 text-xs hover:bg-sidebar-accent/60"
          >
            <span className="min-w-0 flex-1 truncate">
              {nameOf(document, item)}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Drop ${nameOf(document, item)} from the selection`}
              onClick={() => select(item, "toggle")}
            >
              <X />
            </Button>
          </li>
        ))}
      </ol>
      {refs !== undefined && <TargetActionsSection view={view} refs={refs} />}
    </>
  );
}

/** "2 Fixtures, 3 Elements", in the order the kinds appear. */
function summary(selected: readonly Selection[]): string {
  const counts = new Map<string, number>();
  for (const item of selected)
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  return [...counts]
    .map(([kind, count]) => {
      const plural =
        kind === "installation"
          ? "Installations"
          : entities[kind as EntityKind].label;
      return `${String(count)} ${count === 1 ? plural.replace(/s$/, "") : plural}`;
    })
    .join(", ");
}

const TABLES: Record<EntityKind, keyof Document | undefined> = {
  universe: "universes",
  output: "outputs",
  fixture: "fixtures",
  element: undefined,
  set: "fixtureSets",
  scene: "scenes",
  layer: "layers",
  controller: "controllers",
  macro: "macros",
};

function nameOf(document: Document, item: Selection): string {
  if (item.kind === "installation") return document.installation.name;
  if (item.kind === "element") return targetLabel(document, item.id);
  const table = TABLES[item.kind];
  const entity =
    table === undefined
      ? undefined
      : (document[table] as Record<string, { name?: string }>)[item.id];
  return entity?.name ?? item.id;
}
