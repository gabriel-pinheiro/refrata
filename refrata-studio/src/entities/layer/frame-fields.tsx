import type { DocumentView } from "@refrata/client";
import type { Frame, VisualLayer } from "@refrata/core";
import { Maximize } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { NumberField } from "@/inspector/fields/number-field";
import { useCommand } from "@/lib/client";

/**
 * The Frame of a Layer running a Geometry Visual: its centre, size and
 * rotation as fields, and "Fit to Targets", which puts it around what the
 * Layer's Targets draw again, since a Frame does not follow Targets that
 * join later. The Rig View draws the same Frame while the Layer is
 * selected, and dragging it there writes the same fields.
 */
export function FrameFields({
  view,
  layer,
}: {
  readonly view: DocumentView;
  readonly layer: VisualLayer;
}) {
  const command = useCommand(view);
  const frame = layer.frame;
  if (frame === undefined) return null;
  const set = (field: keyof Frame, value: number): void =>
    void command("layer.frame.set", {
      layerId: layer.id,
      frame: { [field]: value },
    });
  return (
    <InspectorSection
      storageKey="frame"
      label="Frame"
      actions={
        <Button
          variant="ghost"
          size="xs"
          title="Put the Frame around everything the Layer's Targets draw."
          onClick={() =>
            void command("layer.frame.set", { layerId: layer.id, fit: true })
          }
        >
          <Maximize /> Fit to Targets
        </Button>
      }
    >
      <p className="text-[0.6875rem]/relaxed text-muted-foreground">
        What the Visual measures its Targets against. Drag it in the Rig View
        while {layer.name} is selected, or set it here.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <NumberField
          label="X"
          value={frame.x}
          step={0.05}
          unit="m"
          onCommit={(value) => set("x", value)}
        />
        <NumberField
          label="Y"
          value={frame.y}
          step={0.05}
          unit="m"
          onCommit={(value) => set("y", value)}
        />
        <NumberField
          label="Rotation"
          value={frame.rotation}
          decimals={1}
          step={1}
          unit="°"
          onCommit={(value) => set("rotation", value)}
        />
        <NumberField
          label="Width"
          value={frame.width}
          step={0.05}
          unit="m"
          onCommit={(value) => set("width", Math.max(0.01, value))}
        />
        <NumberField
          label="Height"
          value={frame.height}
          step={0.05}
          unit="m"
          onCommit={(value) => set("height", Math.max(0.01, value))}
        />
      </div>
    </InspectorSection>
  );
}
