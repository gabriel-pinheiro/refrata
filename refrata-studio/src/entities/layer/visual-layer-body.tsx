import type { DocumentView } from "@refrata/client";
import {
  cueAddress,
  paramAddress,
  resolveAddress,
  visualDefinition,
  type Document,
  type VisualLayer,
} from "@refrata/core";
import { TriangleAlert, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { macroIcons } from "@/entities/macro/macro-icons";
import { useMakeMacro } from "@/entities/macro/use-make-macro";
import { AddressRow } from "@/inspector/fields/address-row";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { useRowLinks } from "@/inspector/fields/use-row-links";
import { useCommand } from "@/lib/client";

import { VisualBindings } from "./visual-bindings";
import { VisualPicker } from "./visual-picker";

const MacroIcon = macroIcons.macro;

/**
 * What a Visual Layer has beyond any Layer: the Visual it runs, with a way
 * to choose another; one row per Visual Parameter, each an Address a
 * Controller can take; the Slot Bindings; and a button per Cue, whose menu
 * makes the Macro a hub's pad needs.
 * A Layer whose Visual the Catalog does not know says so and still lets
 * the person choose another.
 */
export function VisualLayerBody({
  view,
  document,
  layer,
  children,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: VisualLayer;
  /** Shown right after the Visual section: the Targets, which say what the Visual distributes across. */
  readonly children: ReactNode;
}) {
  const command = useCommand(view);
  const rowLinks = useRowLinks(view);
  const makeMacro = useMakeMacro(view);
  const [changing, setChanging] = useState(false);
  const definition = visualDefinition(layer.visual);
  return (
    <>
      <InspectorSection
        storageKey="visual"
        label="Visual"
        actions={
          <Button variant="ghost" size="xs" onClick={() => setChanging(true)}>
            Change
          </Button>
        }
      >
        {definition === undefined ? (
          <p
            className="flex items-start gap-1.5 text-[0.6875rem]/relaxed text-amber-300"
            data-testid="unknown-visual"
          >
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            <span>
              This version's Catalog has no Visual “{layer.visual}”, so{" "}
              {layer.name} contributes nothing. Change the Visual or remove the
              Layer.
            </span>
          </p>
        ) : (
          <div className="grid gap-0.5 text-xs">
            <p className="font-medium">{definition.name}</p>
            <p className="text-[0.6875rem]/snug text-muted-foreground">
              {definition.description}
            </p>
          </div>
        )}
      </InspectorSection>
      {children}
      {definition !== undefined && (
        <>
          <InspectorSection storageKey="visual-parameters" label="Parameters">
            {Object.entries(definition.parameters).map(([name, parameter]) => {
              const resolved = resolveAddress(
                document,
                paramAddress(layer.id, name),
              );
              if (resolved === undefined) return null;
              return (
                <AddressRow
                  key={name}
                  resolved={resolved}
                  value={layer.parameters[name] ?? parameter.default}
                  description={parameter.description}
                  onEdit={(value) =>
                    command("address.edit", {
                      address: resolved.address,
                      value,
                    })
                  }
                  links={rowLinks(resolved, `${layer.name} ${parameter.label}`)}
                />
              );
            })}
          </InspectorSection>
          <InspectorSection storageKey="visual-bindings" label="Bindings">
            <VisualBindings view={view} layer={layer} definition={definition} />
          </InspectorSection>
          {definition.cues.length > 0 && (
            <InspectorSection storageKey="visual-cues" label="Cues">
              <div className="flex flex-wrap gap-1.5">
                {definition.cues.map((cue) => (
                  <ContextMenu key={cue.key}>
                    <ContextMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          title={`${cue.description ?? cue.label} (${cueAddress(layer.id, cue.key)})`}
                          onClick={() =>
                            void command("address.trigger", {
                              address: cueAddress(layer.id, cue.key),
                            })
                          }
                        />
                      }
                    >
                      <Zap /> {cue.label}
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onClick={() =>
                          makeMacro(
                            `${layer.name} ${cue.label}`,
                            cueAddress(layer.id, cue.key),
                          )
                        }
                      >
                        <MacroIcon /> Make a Macro
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            </InspectorSection>
          )}
        </>
      )}
      {changing && (
        <VisualPicker
          title={`Change the Visual of ${layer.name}`}
          description="Parameters and bindings start over from the new Visual's defaults, and Links and Macro actions on the old ones go. Targets, opacity and Blend Mode stay."
          current={layer.visual}
          submitLabel="Change Visual"
          onSubmit={(visual) =>
            void command("layer.visual.set", { layerId: layer.id, visual })
          }
          onClose={() => setChanging(false)}
        />
      )}
    </>
  );
}
