import type { DocumentView } from "@refrata/client";
import { isSetRef } from "@refrata/core";
import { ChevronDown, FolderPlus, Layers, Shapes } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InspectorSection } from "@/inspector/fields/inspector-section";

import { useTargetActions, type LayerChoices } from "./use-target-actions";

const NO_LAYERS = "No Layer yet. Add one to a Scene first.";
const NO_SETS = "No Fixture Set yet.";

/**
 * The inspector section for a selection that can be targeted: "Add to Look
 * Layer" (Layers under their Scene), "Add to Set" (hidden when a Set is in
 * the selection, since Sets hold Elements only) and "New Set".
 */
export function TargetActionsSection({
  view,
  refs,
}: {
  readonly view: DocumentView;
  readonly refs: readonly string[];
}) {
  const actions = useTargetActions(view);
  const holdsSet = refs.some(isSetRef);
  const layers = actions.layerChoices.filter(
    (group) => group.layers.length > 0,
  );
  return (
    <InspectorSection storageKey="use-as-target" label="Use as Target">
      <div className="flex flex-wrap gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" />}
            disabled={layers.length === 0}
            title={layers.length === 0 ? NO_LAYERS : undefined}
          >
            <Layers /> Add to Layer <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <LayerItems
              groups={layers}
              onPick={(layer) => actions.addToLayer(layer, refs)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
        {!holdsSet && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
              disabled={actions.setChoices.length === 0}
              title={actions.setChoices.length === 0 ? NO_SETS : undefined}
            >
              <Shapes /> Add to Set <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {actions.setChoices.map((set) => (
                <DropdownMenuItem
                  key={set.id}
                  onClick={() => actions.addToSet(set, refs)}
                >
                  {set.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!holdsSet && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => actions.newSet(refs)}
          >
            <FolderPlus /> New Set
          </Button>
        )}
      </div>
      {actions.dialog}
    </InspectorSection>
  );
}

function LayerItems({
  groups,
  onPick,
}: {
  readonly groups: readonly LayerChoices[];
  readonly onPick: (layer: LayerChoices["layers"][number]) => void;
}) {
  return (
    <>
      {groups.map((group) => (
        <DropdownMenuGroup key={group.scene.id}>
          <DropdownMenuLabel>{group.scene.name}</DropdownMenuLabel>
          {group.layers.map((layer) => (
            <DropdownMenuItem key={layer.id} onClick={() => onPick(layer)}>
              {layer.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      ))}
    </>
  );
}

/** The same actions as context menu entries, for a Fixture or Element row and the Rig View. */
export function TargetContextItems({
  view,
  refs,
}: {
  readonly view: DocumentView;
  readonly refs: readonly string[];
}) {
  const actions = useTargetActions(view);
  const holdsSet = refs.some(isSetRef);
  const layers = actions.layerChoices.filter(
    (group) => group.layers.length > 0,
  );
  return (
    <>
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={layers.length === 0}>
          <Layers /> Add to Layer
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {layers.map((group) => (
            <div key={group.scene.id}>
              <div className="px-2 py-1 text-[0.625rem] tracking-wider text-muted-foreground uppercase">
                {group.scene.name}
              </div>
              {group.layers.map((layer) => (
                <ContextMenuItem
                  key={layer.id}
                  onClick={() => actions.addToLayer(layer, refs)}
                >
                  {layer.name}
                </ContextMenuItem>
              ))}
            </div>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
      {!holdsSet && (
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={actions.setChoices.length === 0}>
            <Shapes /> Add to Set
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {actions.setChoices.map((set) => (
              <ContextMenuItem
                key={set.id}
                onClick={() => actions.addToSet(set, refs)}
              >
                {set.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {!holdsSet && (
        <ContextMenuItem onClick={() => actions.newSet(refs)}>
          <FolderPlus /> New Set from selection
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      {actions.dialog}
    </>
  );
}
