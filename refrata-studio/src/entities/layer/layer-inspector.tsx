import type { DocumentView } from "@refrata/client";
import {
  BLEND_MODE_LABELS,
  BLEND_MODES,
  resolveAddress,
  targetLabel,
  type BlendMode,
  type Layer,
} from "@refrata/core";
import { MousePointerClick, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { AddressRow } from "@/inspector/fields/address-row";
import { InspectorHeading } from "@/inspector/fields/inspector-heading";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { NameField } from "@/inspector/fields/name-field";
import { SelectField } from "@/inspector/fields/select-field";
import { useRowLinks } from "@/inspector/fields/use-row-links";
import { useCommand, useDocumentPath, useSignal } from "@/lib/client";
import { SortableItem, SortableList } from "@/navigator/sortable";
import { useSelection } from "@/selection/selection";

import { AllTargetsRows, TargetBlock } from "./look-rows";

/**
 * A Layer's name and settings: Enabled and, for a Look Layer, Opacity as
 * Address rows a Controller can take, and the Blend Mode. Then the Look
 * Layer's Targets in order (remove, drag to reorder, "Add selection"), the
 * "All Targets" lines writing one Attribute to every Target at once, and
 * one block per Target with its own rows. A Group stops after Enabled.
 */
export function LayerInspector({
  view,
  id,
}: {
  readonly view: DocumentView;
  readonly id: string;
}) {
  const command = useCommand(view);
  const { select, picked } = useSelection();
  const rowLinks = useRowLinks(view);
  const layer = useDocumentPath<Layer>(view, ["layers", id]);
  // Targets and rows read Fixtures, Modes and Sets: the whole document.
  const document = useSignal(view.document);
  useEffect(() => {
    if (layer === undefined) select({ kind: "installation" });
  }, [layer, select]);
  if (layer === undefined || document === undefined) return null;
  const enabled = resolveAddress(document, `layer/${id}/enabled`);
  const opacity = resolveAddress(document, `layer/${id}/opacity`);
  const additions =
    layer.kind === "look"
      ? picked.filter((ref) => !layer.targets.some((t) => t.ref === ref))
      : [];
  return (
    <>
      <InspectorHeading name={layer.name} id={layer.id} />
      <div className="grid gap-3 p-3">
        <NameField
          label="Name"
          value={layer.name}
          onCommit={(name) =>
            void command("layer.rename", { layerId: id, name })
          }
        />
      </div>
      <InspectorSection storageKey="layer" label="Layer">
        {enabled !== undefined && (
          <AddressRow
            resolved={enabled}
            value={layer.enabled}
            onEdit={(value) =>
              command("address.edit", { address: enabled.address, value })
            }
            links={rowLinks(enabled, `${layer.name} Enabled`)}
          />
        )}
        {layer.kind === "look" && opacity !== undefined && (
          <AddressRow
            resolved={opacity}
            value={layer.opacity}
            onEdit={(value) =>
              command("address.edit", { address: opacity.address, value })
            }
            links={rowLinks(opacity, `${layer.name} Opacity`)}
          />
        )}
        {layer.kind === "look" && (
          <SelectField
            label="Blend Mode"
            value={layer.blendMode}
            options={BLEND_MODES.map((mode) => ({
              value: mode,
              label: BLEND_MODE_LABELS[mode],
            }))}
            onValueChange={(blendMode) => {
              if (blendMode !== null && blendMode !== layer.blendMode)
                void command("layer.update", {
                  layerId: id,
                  blendMode: blendMode as BlendMode,
                });
            }}
          />
        )}
      </InspectorSection>
      {layer.kind === "look" && (
        <>
          <InspectorSection
            storageKey="targets"
            label="Targets"
            actions={
              <Button
                variant="ghost"
                size="xs"
                disabled={additions.length === 0}
                title={
                  picked.length === 0
                    ? "Pick Elements or a Set in the Rig View or the navigator first"
                    : undefined
                }
                onClick={() =>
                  void command("layer.targets.add", {
                    layerId: id,
                    targets: additions,
                  })
                }
              >
                <MousePointerClick /> Add selection
                {additions.length > 0 ? ` (${String(additions.length)})` : ""}
              </Button>
            }
          >
            {layer.targets.length === 0 ? (
              <p className="text-[0.6875rem]/relaxed text-muted-foreground">
                {layer.name} reaches nothing yet. Pick Elements or a Set and add
                the selection.
              </p>
            ) : (
              <SortableList
                kind="layer-target"
                listId={`layer-target:${id}`}
                ids={layer.targets.map((target) => target.ref)}
                selectedId={undefined}
                onMove={(target, after) =>
                  void command("layer.targets.move", {
                    layerId: id,
                    target,
                    after,
                  })
                }
              >
                <ol className="grid gap-px" aria-label="Targets">
                  {layer.targets.map((target) => (
                    <SortableItem key={target.ref} id={target.ref}>
                      <li className="flex h-6 items-center gap-1 rounded-sm pl-1 text-xs hover:bg-sidebar-accent/60">
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={target.ref}
                        >
                          {targetLabel(document, target.ref)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove ${targetLabel(document, target.ref)}`}
                          onClick={() =>
                            void command("layer.targets.remove", {
                              layerId: id,
                              targets: [target.ref],
                            })
                          }
                        >
                          <X />
                        </Button>
                      </li>
                    </SortableItem>
                  ))}
                </ol>
              </SortableList>
            )}
          </InspectorSection>
          <InspectorSection storageKey="all-targets" label="All Targets">
            <AllTargetsRows view={view} document={document} layer={layer} />
          </InspectorSection>
          {layer.targets.map((target) => (
            <TargetBlock
              key={target.ref}
              view={view}
              document={document}
              layer={layer}
              target={target.ref}
            />
          ))}
        </>
      )}
    </>
  );
}
