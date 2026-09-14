import {
  attributeDefinition,
  BLEND_MODE_LABELS,
  childLayers,
  isAttributeKey,
  layerEffectivelyEnabled,
  sceneLayers,
  targetLabel,
  type Document,
  type Layer,
  type LookRow,
  type ParameterValue,
  type Scene,
} from "@refrata/core";

import { formatTreeNodes, treeNodes } from "./tree-nodes.ts";

/**
 * The composition as the CLI shows it: Scenes as one line each, a Scene's
 * stack topmost first with each Look Layer's Targets and rows under it, and
 * Sets in their Groups with their members named `Fixture › Element`.
 */

const percent = (value: number): string =>
  `${String(Math.round(value * 100))}%`;

function hex(color: readonly number[]): string {
  return `#${color
    .slice(0, 3)
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** A row's value in its Attribute's units: 40%, 12 Hz, #00ff00, open. */
export function formatRowValue(
  attribute: string,
  value: ParameterValue,
): string {
  if (Array.isArray(value)) return hex(value);
  if (typeof value === "boolean") return value ? "on" : "off";
  if (typeof value !== "number") return String(value);
  const definition = isAttributeKey(attribute)
    ? attributeDefinition(attribute)
    : undefined;
  if (definition?.kind !== "number") return String(value);
  if (definition.percent === true) return percent(value);
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return definition.unit === undefined ? text : `${text} ${definition.unit}`;
}

function describeRow(attribute: string, row: LookRow): string {
  const alpha = row.alpha ?? 1;
  return `${attribute} ${formatRowValue(attribute, row.value)}${alpha === 1 ? "" : ` @ ${percent(alpha)}`}`;
}

export function describeScene(document: Document, scene: Scene): string {
  const count = sceneLayers(document.layers, scene.id).length;
  const playing = document.installation.activeScene === scene.id;
  return `Scene “${scene.name}”  ${scene.id}  ${String(count)} ${count === 1 ? "Layer" : "Layers"}${playing ? "  [playing]" : ""}`;
}

/** One line per Scene, in their order. */
export function formatScenes(document: Document): string[] {
  return Object.values(document.scenes)
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    .map((scene) => describeScene(document, scene));
}

function describeLayer(document: Document, layer: Layer): string {
  const off = layerEffectivelyEnabled(document.layers, layer) ? "" : "  [off]";
  if (layer.kind === "group") return `Group “${layer.name}”  ${layer.id}${off}`;
  const targets = layer.targets
    .map((target) => targetLabel(document, target.ref))
    .join(", ");
  return `Look “${layer.name}”  ${layer.id}  opacity ${percent(layer.opacity)}  ${BLEND_MODE_LABELS[layer.blendMode].toLowerCase()}  targets: ${targets === "" ? "none" : targets}${off}`;
}

/** A Scene's stack topmost first, Groups indented, each Look Layer's rows under it per Target. */
export function formatStack(document: Document, sceneId: string): string[] {
  const lines: string[] = [];
  const visit = (parentId: string | null, depth: number): void => {
    for (const layer of childLayers(document.layers, sceneId, parentId)) {
      lines.push(`${"  ".repeat(depth)}${describeLayer(document, layer)}`);
      if (layer.kind === "group") {
        visit(layer.id, depth + 1);
        continue;
      }
      for (const target of layer.targets) {
        const rows = Object.entries(layer.rows[target.ref] ?? {});
        if (rows.length === 0) continue;
        lines.push(
          `${"  ".repeat(depth + 1)}${targetLabel(document, target.ref)}: ${rows
            .map(([attribute, row]) => describeRow(attribute, row))
            .join(" · ")}`,
        );
      }
    }
  };
  visit(null, 0);
  return lines;
}

/** Sets in their Groups, each with its members in order. */
export function formatSets(document: Document): string[] {
  return formatTreeNodes(treeNodes(document.fixtureSets), (set) => {
    const head = `“${set.name}”  ${set.id}`;
    if (set.kind === "group") return `Group ${head}`;
    const count = set.members.length;
    const members = set.members
      .map((ref) => targetLabel(document, ref))
      .join(", ");
    return `Set ${head}  ${String(count)} ${count === 1 ? "member" : "members"}${count === 0 ? "" : `: ${members}`}`;
  });
}
