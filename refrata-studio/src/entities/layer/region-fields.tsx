import type { DocumentView } from "@refrata/client";
import {
  linksUnder,
  REGION_AXES,
  REGION_FORM_LABELS,
  REGION_FORMS,
  regionAimNames,
  regionFlags,
  regionPlace,
  regionPlacePrefix,
  settings,
  type Document,
  type RegionForm,
  type VisualDefinition,
  type VisualLayer,
} from "@refrata/core";
import { Plus, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldRow } from "@/inspector/fields/field-row";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { NumberField } from "@/inspector/fields/number-field";
import { useCommand } from "@/lib/client";

import { RegionAimLine } from "./region-aim-line";

const FORM_ITEMS = REGION_FORMS.map((form) => ({
  value: form,
  label: REGION_FORM_LABELS[form],
}));

/**
 * The Region of a Layer running a movement Visual, in place of the
 * bindings of the two Slots that run along it: how it is written, by
 * corners or by center and size, one Aim line per corner or for the
 * center, the size of one by center, and the ends a mover cannot go to.
 * On the Blend Mode Add it is by center and size only and its center reads
 * Offset. A Layer without one says so and offers it.
 */
export function RegionFields({
  view,
  document,
  layer,
  definition,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: VisualLayer;
  readonly definition: VisualDefinition;
}) {
  const command = useCommand(view);
  if (definition.region === undefined) return null;
  const region = layer.region;
  const set = (fields: Record<string, unknown>): void =>
    void command("layer.region.set", { layerId: layer.id, ...fields });
  if (region === undefined)
    return (
      <InspectorSection
        storageKey="region"
        label="Region"
        actions={
          <Button variant="ghost" size="xs" onClick={() => set({})}>
            <Plus /> Add Region
          </Button>
        }
      >
        <p className="text-[0.6875rem]/relaxed text-muted-foreground">
          {layer.name} has no Region, so what {definition.name} draws goes
          through its bindings.
        </p>
      </InspectorSection>
    );
  const relative = layer.blendMode === "add";
  const linked = linksUnder(document.links, regionPlacePrefix(layer.id));
  // A typed corner beyond reach is flagged on its own Aim line; here go the ends no line shows.
  const typed = new Set(
    region.form === "corners"
      ? (["from", "to"] as const).flatMap((aim) =>
          REGION_AXES.filter(
            (axis) =>
              !linked.some(
                (link) => link.address === regionPlace(layer.id, aim, axis),
              ),
          ).map((axis) => `${axis} ${String(region[aim][axis])}`),
        )
      : [],
  );
  const flags = regionFlags(document, layer, region).filter(
    (flag) => !typed.has(`${flag.axis} ${String(flag.value)}`),
  );
  const degrees = (value: number): string =>
    value.toFixed(settings.aim.decimals);
  return (
    <InspectorSection
      storageKey="region"
      label="Region"
      actions={
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Remove Region"
          title="Remove the Region. Its Slots take bindings."
          onClick={() =>
            void command("layer.region.remove", { layerId: layer.id })
          }
        >
          <X />
        </Button>
      }
    >
      <p className="text-[0.6875rem]/relaxed text-muted-foreground">
        {relative
          ? `The box ${definition.name} draws inside, around what is below.`
          : linked.length > 0
            ? `The box ${definition.name} draws inside. Each mover takes its own.`
            : `The box ${definition.name} draws inside.`}
      </p>
      <FieldRow
        label="Written by"
        description={
          relative
            ? "On Add a Region is an offset and a size. Corners are places."
            : "Corners are two Aims. Center and size is one Aim with a width and a height."
        }
      >
        <Select
          value={region.form}
          items={FORM_ITEMS}
          disabled={relative}
          onValueChange={(next: RegionForm | null) => {
            if (next !== null && next !== region.form) set({ form: next });
          }}
        >
          <SelectTrigger aria-label="Region form" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORM_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      {regionAimNames(region.form).map((aim) => (
        <RegionAimLine
          key={aim}
          view={view}
          document={document}
          layer={layer}
          region={region}
          aim={aim}
        />
      ))}
      {region.form === "center" && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Width"
            value={region.width}
            decimals={settings.aim.decimals}
            step={1}
            unit="°"
            onCommit={(value) => set({ width: Math.max(0, value) })}
          />
          <NumberField
            label="Height"
            value={region.height}
            decimals={settings.aim.decimals}
            step={1}
            unit="°"
            onCommit={(value) => set({ height: Math.max(0, value) })}
          />
        </div>
      )}
      {flags.length > 0 && (
        <p
          className="flex items-start gap-1 text-[0.625rem] text-amber-300"
          data-testid="region-flags"
        >
          <TriangleAlert aria-hidden className="mt-px size-3 shrink-0" />
          <span>
            {flags
              .map(
                (flag) =>
                  `${flag.label} cannot go to ${flag.axis} ${degrees(flag.value)}°`,
              )
              .join(". ")}
          </span>
        </p>
      )}
    </InspectorSection>
  );
}
