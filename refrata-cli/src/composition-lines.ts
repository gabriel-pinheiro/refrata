import {
  ALL_TARGETS_LABEL,
  BLEND_MODE_LABELS,
  childLayers,
  expandTargets,
  isRuleSet,
  layerEffectivelyEnabled,
  sceneLayers,
  setMembers,
  targetLabel,
  type Document,
  type Layer,
  type LookRow,
  type Scene,
} from "@refrata/core";

import { formatRule, unmatchedTags } from "./tag-lines.ts";
import { formatTreeNodes, treeNodes } from "./tree-nodes.ts";
import { formatRowValue, percent } from "./value-lines.ts";
import { visualLayerLines, visualName } from "./visual-lines.ts";

export { formatRowValue } from "./value-lines.ts";

/**
 * The composition as the CLI shows it: Scenes as one line each, a Scene's
 * stack topmost first with each Look Layer's Targets and rows under it and
 * each Visual Layer's Visual, Parameters, bindings and Cues (a spread Target
 * with what it expands to), and Sets in their Groups with
 * their Rules and their members named `Fixture › Element`.
 */

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

/** "fade in 2 s ease-in-out, out 1 s" for the directions with a time; nothing for a cut. */
function describeFade(layer: Layer): string {
  const parts = (["fadeIn", "fadeOut"] as const).flatMap((direction) => {
    const fade = layer[direction];
    if (fade.time <= 0) return [];
    const curve = fade.curve === "linear" ? "" : ` ${fade.curve}`;
    return [
      `${direction === "fadeIn" ? "in" : "out"} ${String(fade.time)} s${curve}`,
    ];
  });
  return parts.length === 0 ? "" : `  fade ${parts.join(", ")}`;
}

function describeLayer(document: Document, layer: Layer): string {
  const off = layerEffectivelyEnabled(document.layers, layer) ? "" : "  [off]";
  if (layer.kind === "group")
    return `Group “${layer.name}”  ${layer.id}  opacity ${percent(layer.opacity)}${describeFade(layer)}${off}`;
  const targets = layer.targets
    .map(
      (target) =>
        `${targetLabel(document, target.ref)}${target.spread ? " (spread)" : ""}`,
    )
    .join(", ");
  const kind = layer.kind === "look" ? "Look" : `Visual (${visualName(layer)})`;
  return `${kind} “${layer.name}”  ${layer.id}  opacity ${percent(layer.opacity)}  ${BLEND_MODE_LABELS[layer.blendMode].toLowerCase()}${describeFade(layer)}  targets: ${targets === "" ? "none" : targets}${off}`;
}

/** A Scene's stack topmost first, Groups indented; under a Look Layer its rows, All Targets first, then per Target; under a Visual Layer what `visualLayerLines` says. */
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
      if (layer.kind === "visual")
        for (const line of visualLayerLines(document, layer))
          lines.push(`${indent}${line}`);
      const shared =
        layer.kind === "look"
          ? describeRows(ALL_TARGETS_LABEL, layer.all)
          : undefined;
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
        if (layer.kind !== "look") continue;
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
