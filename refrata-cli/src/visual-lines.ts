import {
  attributeDefinition,
  cueAddress,
  isAttributeKey,
  linkAt,
  paramAddress,
  spreadWarning,
  visualDefinition,
  type Document,
  type Frame,
  type ParameterDefinition,
  type SlotBinding,
  type SlotDefinition,
  type VisualDefinition,
  type VisualLayer,
} from "@refrata/core";

import { formatRowValue, formatValue } from "./value-lines.ts";

/**
 * Visuals as the CLI shows them: the Catalog one block per Visual, and
 * under a Visual Layer of a stack its Parameters, bindings, Cues, the
 * Frame of a Geometry Visual's Layer and the one-Target warning.
 */

const NONE = "none";
const NOT_BOUND = "not bound";

/** `level on dimmer (0% to 100%)`, `color on color`, `color not bound`. */
export function describeBinding(
  slot: SlotDefinition,
  binding: SlotBinding | undefined,
): string {
  const attribute = binding?.attribute ?? null;
  if (attribute === null) return `${slot.key} ${NOT_BOUND}`;
  if (slot.kind !== "number" || !isAttributeKey(attribute))
    return `${slot.key} on ${attribute}`;
  const definition = attributeDefinition(attribute);
  if (definition.kind !== "number") return `${slot.key} on ${attribute}`;
  const from = formatRowValue(attribute, binding?.from ?? definition.min);
  const to = formatRowValue(attribute, binding?.to ?? definition.max);
  return `${slot.key} on ${attribute} (${from} to ${to})`;
}

function describeParameter(
  name: string,
  parameter: ParameterDefinition,
): string {
  const head = `${name} (${parameter.kind})`;
  const fallback = `default ${formatValue(parameter.default, parameter.kind === "number" ? parameter : undefined)}`;
  switch (parameter.kind) {
    case "number": {
      const step =
        parameter.step === undefined ? "" : ` step ${String(parameter.step)}`;
      return `${head} ${formatValue(parameter.min, parameter)} to ${formatValue(parameter.max, parameter)}${step}, ${fallback}`;
    }
    case "choice":
      return `${head} ${parameter.options.map((option) => option.value).join("|")}, ${fallback}`;
    default:
      return `${head} ${fallback}`;
  }
}

/** One Visual of the Catalog: what it is, its Slots, Parameters and Cues. */
export function formatVisual(definition: VisualDefinition): string[] {
  return [
    `${definition.id}  “${definition.name}”  ${definition.description}${definition.distributes ? "  [distributes across Targets]" : ""}${definition.geometry === undefined ? "" : "  [Geometry Visual: reads where its Targets are in its Layer's Frame]"}`,
    `  Slots: ${definition.slots
      .map(
        (slot) =>
          `${slot.key} (${slot.kind}) ${slot.attribute === null ? NOT_BOUND : `on ${slot.attribute}`}`,
      )
      .join(", ")}`,
    ...(definition.blendMode === undefined
      ? []
      : [`  Blend Mode: a new Layer starts on ${definition.blendMode}`]),
    "  Parameters:",
    ...Object.entries(definition.parameters).map(
      ([name, parameter]) => `    ${describeParameter(name, parameter)}`,
    ),
    `  Cues: ${
      definition.cues.length === 0
        ? NONE
        : definition.cues
            .map(
              (cue) =>
                `${cue.key}${cue.description === undefined ? "" : ` (${cue.description})`}`,
            )
            .join(", ")
    }`,
  ];
}

export function formatCatalog(catalog: readonly VisualDefinition[]): string[] {
  return catalog.flatMap((definition, index) => [
    ...(index === 0 ? [] : [""]),
    ...formatVisual(definition),
  ]);
}

/** The Visual's name after a Visual Layer's kind, or that the Catalog lacks it. */
export function visualName(layer: VisualLayer): string {
  return (
    visualDefinition(layer.visual)?.name ??
    `unknown Visual “${layer.visual}”, contributes nothing`
  );
}

/** `2.00 m × 1.00 m at (0.50, 0.75), turned 30°`: a Frame as the CLI prints it. */
export function describeFrame(frame: Frame): string {
  const metres = (value: number): string => `${value.toFixed(2)} m`;
  const turned =
    frame.rotation === 0 ? "" : `, turned ${String(frame.rotation)}°`;
  return `${metres(frame.width)} × ${metres(frame.height)} at (${frame.x.toFixed(2)}, ${frame.y.toFixed(2)})${turned}`;
}

/** The lines under a Visual Layer in a stack: Parameters (a linked one says who drives it), bindings, the Frame, Cues, the warning. */
export function visualLayerLines(
  document: Document,
  layer: VisualLayer,
): string[] {
  const definition = visualDefinition(layer.visual);
  if (definition === undefined) return [];
  const parameters = Object.entries(definition.parameters).map(
    ([name, parameter]) => {
      const link = linkAt(document, paramAddress(layer.id, name));
      const value = layer.parameters[name] ?? parameter.default;
      const text = formatValue(
        value,
        parameter.kind === "number" ? parameter : undefined,
      );
      if (link === undefined) return `${name} ${text}`;
      const controller =
        document.controllers[link.controllerId]?.name ?? link.controllerId;
      return `${name} ${text} (controlled by ${controller})`;
    },
  );
  const lines = [
    `parameters: ${parameters.join(", ")}`,
    `bindings: ${definition.slots
      .map((slot) => describeBinding(slot, layer.bindings[slot.key]))
      .join(", ")}`,
  ];
  if (definition.geometry !== undefined)
    lines.push(
      layer.frame === undefined
        ? "frame: none, so the Visual releases everything; set one with layers frame"
        : `frame: ${describeFrame(layer.frame)}`,
    );
  if (definition.cues.length > 0)
    lines.push(
      `cues: ${definition.cues
        .map((cue) => `${cue.key} (${cueAddress(layer.id, cue.key)})`)
        .join(", ")}`,
    );
  const warning = spreadWarning(document, layer);
  if (warning !== undefined) lines.push(`warning: ${warning}`);
  return lines;
}
