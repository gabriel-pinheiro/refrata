import { effectiveAt } from "../address/links.ts";
import { numberProblem, type ParameterValues } from "../parameters.ts";
import { ATTRIBUTES, isAttributeKey } from "../rig/attributes.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import type {
  SlotDefinition,
  VisualDefinition,
  VisualTarget,
} from "../visuals/sdk.ts";
import type { BlendMode, SlotBinding, VisualLayer } from "./composition.ts";
import type { Document } from "./document.ts";
import { regionForBlend, type Region } from "./region.ts";
import {
  expandTargets,
  type ExpandedTarget,
  type TargetSource,
} from "./targets.ts";

/** The Address of one Visual Parameter of a Layer. */
export function paramAddress(layerId: string, name: string): string {
  return `layer/${layerId}/param/${name}`;
}

/** The Address of one Cue of a Layer. */
export function cueAddress(layerId: string, key: string): string {
  return `layer/${layerId}/cue/${key}`;
}

/** The binding a new Layer gives a Slot: the Visual's default Attribute over that Attribute's whole range. */
export function defaultBinding(
  slot: SlotDefinition,
  attribute: string | null = slot.attribute,
): SlotBinding {
  if (attribute === null || !isAttributeKey(attribute))
    return { attribute: null };
  const definition = ATTRIBUTES[attribute];
  return slot.kind === "number" && definition.kind === "number"
    ? { attribute, from: definition.min, to: definition.max }
    : { attribute };
}

export function defaultBindings(
  definition: VisualDefinition,
): Record<string, SlotBinding> {
  return Object.fromEntries(
    definition.slots.map((slot) => [slot.key, defaultBinding(slot)]),
  );
}

/** Whether a Slot of `definition` runs along its Region. */
export function isRegionSlot(
  definition: VisualDefinition | undefined,
  slot: string,
): boolean {
  const region = definition?.region;
  return (
    region !== undefined && (region.width === slot || region.height === slot)
  );
}

/**
 * What a new Layer of a Visual starts with besides its Parameter Values:
 * the default binding of every Slot, and for a Visual that draws inside a
 * Region the Region it declares, as the Layer's Blend Mode may hold it, in
 * place of the bindings of the Slots that run along it.
 */
export function startingSlots(
  definition: VisualDefinition,
  blendMode: BlendMode,
): {
  readonly bindings: Record<string, SlotBinding>;
  readonly region?: Region;
} {
  if (definition.region === undefined)
    return { bindings: defaultBindings(definition) };
  return {
    bindings: Object.fromEntries(
      Object.entries(defaultBindings(definition)).filter(
        ([slot]) => !isRegionSlot(definition, slot),
      ),
    ),
    region: regionForBlend(definition.region.default, blendMode),
  };
}

/**
 * Why a Slot cannot take `binding`, or undefined when it can: the
 * Attribute must exist and be of the Slot's kind, and a number Slot's
 * anchors must lie within the Attribute's range. Reversed anchors invert.
 */
export function bindingProblem(
  slot: SlotDefinition,
  binding: SlotBinding,
): string | undefined {
  if (binding.attribute === null) return undefined;
  if (!isAttributeKey(binding.attribute))
    return `“${binding.attribute}” is not an Attribute.`;
  const attribute = ATTRIBUTES[binding.attribute];
  if (attribute.kind !== slot.kind)
    return `${slot.label} is a ${slot.kind} Slot and ${attribute.label} is a ${attribute.kind}.`;
  if (attribute.kind !== "number") {
    return binding.from === undefined && binding.to === undefined
      ? undefined
      : `${attribute.label} is a color; only a number binding has a range.`;
  }
  for (const anchor of [binding.from, binding.to]) {
    const problem = numberProblem(attribute, anchor ?? attribute.min);
    if (problem !== undefined)
      return `The range of ${attribute.label} ${problem}.`;
  }
  return undefined;
}

/** The Layer's Parameter Values as the show sees them: a linked one from its Controller, a missing one from the schema's default. */
export function visualParameters(
  document: Document,
  layer: VisualLayer,
  definition: VisualDefinition,
): ParameterValues {
  const values: Record<string, ParameterValues[string]> = {};
  for (const [name, parameter] of Object.entries(definition.parameters))
    values[name] =
      effectiveAt(
        document,
        paramAddress(layer.id, name),
        layer.parameters[name],
      ) ?? parameter.default;
  return values;
}

/**
 * A Visual Layer's Targets as its Visual sees them: Spread applied, in
 * order, each keyed by its ref. A ref reached twice keeps its first place.
 */
export function visualTargets(
  document: TargetSource,
  layer: VisualLayer,
): {
  readonly targets: readonly VisualTarget[];
  readonly expanded: readonly ExpandedTarget[];
} {
  const seen = new Set<string>();
  const expanded = expandTargets(document, layer.targets).filter((target) => {
    if (seen.has(target.ref)) return false;
    seen.add(target.ref);
    return true;
  });
  return {
    expanded,
    targets: expanded.map((target, index) => ({
      key: target.ref,
      index,
      count: expanded.length,
    })),
  };
}

/** What Studio and the CLI warn about: a Visual that distributes across Targets, handed one or none. */
export function spreadWarning(
  document: TargetSource,
  layer: VisualLayer,
): string | undefined {
  const definition = visualDefinition(layer.visual);
  if (definition?.distributes !== true || layer.targets.length === 0)
    return undefined;
  if (visualTargets(document, layer).targets.length > 1) return undefined;
  return `${definition.name} has one Target, so everything in it moves together. Spread it to step through its parts.`;
}
