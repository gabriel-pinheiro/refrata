import type { DocumentView } from "@refrata/client";
import {
  BLEND_MODE_LABELS,
  BLEND_MODES,
  isTargetedLayer,
  resolveAddress,
  type BlendMode,
  type Layer,
} from "@refrata/core";
import { useEffect } from "react";

import { AddressRow } from "@/inspector/fields/address-row";
import { InspectorHeading } from "@/inspector/fields/inspector-heading";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { NameField } from "@/inspector/fields/name-field";
import { SelectField } from "@/inspector/fields/select-field";
import { useRowLinks } from "@/inspector/fields/use-row-links";
import { useCommand, useDocumentPath, useSignal } from "@/lib/client";
import { useSelection } from "@/selection/selection";

import { LayerTargets } from "./layer-targets";
import { AllTargetsRows, TargetBlock } from "./look-rows";
import { VisualLayerBody } from "./visual-layer-body";

/**
 * A Layer's name and settings: Enabled and, for every kind but a Group,
 * Opacity as Address rows a Controller can take, and the Blend Mode. A
 * Visual Layer then shows its Visual, Parameters, Bindings and Cues. Then
 * the Targets, and for a Look Layer the "All Targets" rows every Target
 * takes unless it has its own, and one block per Target with its own rows.
 * A Group stops after Enabled.
 */
export function LayerInspector({
  view,
  id,
}: {
  readonly view: DocumentView;
  readonly id: string;
}) {
  const command = useCommand(view);
  const { select } = useSelection();
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
        {isTargetedLayer(layer) && opacity !== undefined && (
          <AddressRow
            resolved={opacity}
            value={layer.opacity}
            onEdit={(value) =>
              command("address.edit", { address: opacity.address, value })
            }
            links={rowLinks(opacity, `${layer.name} Opacity`)}
          />
        )}
        {isTargetedLayer(layer) && (
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
      {layer.kind === "visual" && (
        <VisualLayerBody view={view} document={document} layer={layer}>
          <LayerTargets view={view} document={document} layer={layer} />
        </VisualLayerBody>
      )}
      {layer.kind === "look" && (
        <LayerTargets view={view} document={document} layer={layer} />
      )}
      {layer.kind === "look" && (
        <>
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
