import type { DocumentView } from "@refrata/client";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTES,
  defaultBinding,
  isAttributeKey,
  type SlotDefinition,
  type VisualDefinition,
  type VisualLayer,
} from "@refrata/core";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldRow } from "@/inspector/fields/field-row";
import { RangeField } from "@/inspector/fields/range-field";
import { useCommand } from "@/lib/client";

const NONE = { value: null, label: "None" } as const;

/**
 * One block per Slot of the Layer's Visual: the Attribute it reaches, among
 * those of the Slot's kind, or None; and for a number Slot the range of the
 * Attribute its 0 to 1 travels, in the Attribute's units. The range
 * calibrates the Layer to its fixtures and is not an Address; what is
 * performed is the Visual's Parameters.
 */
export function VisualBindings({
  view,
  layer,
  definition,
}: {
  readonly view: DocumentView;
  readonly layer: VisualLayer;
  readonly definition: VisualDefinition;
}) {
  return (
    <>
      {definition.slots.map((slot) => (
        <SlotRows key={slot.key} view={view} layer={layer} slot={slot} />
      ))}
      {definition.slots.every(
        (slot) => (layer.bindings[slot.key]?.attribute ?? null) === null,
      ) && (
        <p className="text-[0.6875rem]/relaxed text-amber-300">
          No Slot is bound, so {layer.name} reaches nothing.
        </p>
      )}
    </>
  );
}

function SlotRows({
  view,
  layer,
  slot,
}: {
  readonly view: DocumentView;
  readonly layer: VisualLayer;
  readonly slot: SlotDefinition;
}) {
  const command = useCommand(view);
  const binding = layer.bindings[slot.key] ?? { attribute: null };
  const items = [
    NONE,
    ...ATTRIBUTE_KEYS.filter((key) => ATTRIBUTES[key].kind === slot.kind).map(
      (key) => ({ value: key, label: ATTRIBUTES[key].label }),
    ),
  ];
  const attribute =
    binding.attribute !== null && isAttributeKey(binding.attribute)
      ? ATTRIBUTES[binding.attribute]
      : undefined;
  const fallback = defaultBinding(slot, slot.attribute);
  const isDefault =
    binding.attribute === fallback.attribute &&
    (binding.from ?? fallback.from) === fallback.from &&
    (binding.to ?? fallback.to) === fallback.to;
  return (
    <>
      <FieldRow
        label={slot.label}
        description={`The ${slot.kind} Slot “${slot.label}”: the Attribute it reaches on every Target that has it.`}
        onReset={
          isDefault
            ? undefined
            : () =>
                void command("layer.binding.set", {
                  layerId: layer.id,
                  slot: slot.key,
                  ...fallback,
                })
        }
      >
        <Select
          value={binding.attribute}
          items={items}
          onValueChange={(next: string | null) => {
            if (next !== binding.attribute)
              void command("layer.binding.set", {
                layerId: layer.id,
                slot: slot.key,
                attribute: next,
              });
          }}
        >
          <SelectTrigger
            aria-label={`Attribute of ${slot.label}`}
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value ?? ""} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      {attribute?.kind === "number" && (
        <FieldRow
          label="Range"
          description={`How far ${attribute.label} travels on these fixtures: where the Slot's 0 and its 1 land. Reversed inverts.`}
        >
          <RangeField
            label={`Range of ${slot.label} on ${attribute.label}`}
            bounds={attribute}
            from={binding.from ?? attribute.min}
            to={binding.to ?? attribute.max}
            onCommit={(ends) =>
              void command("layer.binding.set", {
                layerId: layer.id,
                slot: slot.key,
                attribute: attribute.key,
                ...ends,
              })
            }
          />
        </FieldRow>
      )}
    </>
  );
}
