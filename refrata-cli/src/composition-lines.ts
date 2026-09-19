import {
  ALL_TARGETS_LABEL,
  attributeDefinition,
  BLEND_MODE_LABELS,
  childLayers,
  expandTargets,
  isAttributeKey,
  isRuleSet,
  layerEffectivelyEnabled,
  sceneLayers,
  setMembers,
  targetLabel,
  type Document,
  type Layer,
  type LookRow,
  type ParameterValue,
  type Scene,
} from "@refrata/core";

import { formatRule, unmatchedTags } from "./tag-lines.ts";
import { formatTreeNodes, treeNodes } from "./tree-nodes.ts";

/**
 * The composition as the CLI shows it: Scenes as one line each, a Scene's
 * stack topmost first with each Look Layer's Targets and rows under it (a
 * spread Target with what it expands to), and Sets in their Groups with
 * their Rules and their members named `Fixture › Element`.
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
  return `${attribute} ${formatRowValue(attribute, row.value)}`;
}

function describeRows(
  label: string,
  rows: Readonly<Record<string, LookRow>>,
): string | undefined {
  const entries = Object.entries(rows);
  if (entries.length === 0) return undefined;
  return `${label}: ${entries
    .map(([attribute, row]) => describeRow(attribute, row))
    .join(" · ")}`;
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
    .map(
      (target) =>
        `${targetLabel(document, target.ref)}${target.spread ? " (spread)" : ""}`,
    )
    .join(", ");
  return `Look “${layer.name}”  ${layer.id}  opacity ${percent(layer.opacity)}  ${BLEND_MODE_LABELS[layer.blendMode].toLowerCase()}  targets: ${targets === "" ? "none" : targets}${off}`;
}

/** A Scene's stack topmost first, Groups indented, each Look Layer's rows under it: All Targets first, then per Target. */
export function formatStack(document: Document, sceneId: string): string[] {
  const lines: string[] = [];
  const visit = (parentId: string | null, depth: number): void => {
    for (const layer of childLayers(document.layers, sceneId, parentId)) {
      lines.push(`${"  ".repeat(depth)}${describeLayer(document, layer)}`);
      if (layer.kind === "group") {
        visit(layer.id, depth + 1);
        continue;
      }
      const indent = "  ".repeat(depth + 1);
      const shared = describeRows(ALL_TARGETS_LABEL, layer.all);
      if (shared !== undefined) lines.push(`${indent}${shared}`);
      for (const target of layer.targets) {
        if (target.spread) {
          const expanded = expandTargets(document, [target])
            .map((entry) => targetLabel(document, entry.ref))
            .join(", ");
          lines.push(
            `${indent}${targetLabel(document, target.ref)} spreads to: ${expanded === "" ? "nothing" : expanded}`,
          );
        }
        const line = describeRows(
          targetLabel(document, target.ref),
          layer.rows[target.ref] ?? {},
        );
        if (line !== undefined) lines.push(`${indent}${line}`);
      }
    }
  };
  visit(null, 0);
  return lines;
}

/** Sets in their Groups, each with its members in order; a Set by rule with its Rules first and the members they give now. */
export function formatSets(document: Document): string[] {
  return formatTreeNodes(treeNodes(document.fixtureSets), (set) => {
    const head = `“${set.name}”  ${set.id}`;
    if (set.kind === "group") return `Group ${head}`;
    const refs = setMembers(document, set);
    const count = refs.length;
    const members = refs.map((ref) => targetLabel(document, ref)).join(", ");
    const tail = `${String(count)} ${count === 1 ? "member" : "members"}${count === 0 ? "" : `: ${members}`}`;
    if (!isRuleSet(set)) return `Set ${head}  ${tail}`;
    const unmatched = unmatchedTags(document, set.rules);
    const rules =
      set.rules.length === 0
        ? "no Rules"
        : set.rules
            .map(
              (rule, index) =>
                `${String(index + 1)}. ${formatRule(rule, unmatched)}`,
            )
            .join("  ");
    return `Set ${head}  by rule: ${rules}  ${tail}`;
  });
}
