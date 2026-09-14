import type { DocumentView } from "@refrata/client";

import { PanelHeader } from "@/components/panel-header";
import { entities } from "@/entities";
import { InstallationInspector } from "@/entities/installation/installation-inspector";
import { SelectionInspector } from "@/selection/selection-inspector";
import { soleSelection, useSelection } from "@/selection/selection";

/** Settings of whatever is selected: one thing's own inspector, or the selection inspector for several. */
export function Inspector({ view }: { readonly view: DocumentView }) {
  const { selected } = useSelection();
  const only = soleSelection(selected);
  return (
    <aside className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <PanelHeader>Inspector</PanelHeader>
      <div className="@container min-h-0 overflow-auto">
        {selected.length === 0 ? (
          <p className="p-3 text-muted-foreground">
            Nothing selected. Click an item in the navigator to see its settings
            here.
          </p>
        ) : only === undefined ? (
          <SelectionInspector view={view} />
        ) : only.kind === "installation" ? (
          <InstallationInspector view={view} />
        ) : (
          <EntityInspector view={view} kind={only.kind} id={only.id} />
        )}
      </div>
    </aside>
  );
}

function EntityInspector({
  view,
  kind,
  id,
}: {
  readonly view: DocumentView;
  readonly kind: keyof typeof entities;
  readonly id: string;
}) {
  const { Inspector: Component } = entities[kind];
  return <Component key={`${kind}:${id}`} view={view} id={id} />;
}
