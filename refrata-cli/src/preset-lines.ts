import {
  ALL_ELEMENTS_LABEL,
  ALL_TARGETS_REF,
  isAttributeKey,
  isPresetLink,
  linkAt,
  linksUnder,
  linkSourceName,
  presetOfLink,
  presetRowAddress,
  presetRowValues,
  resolveAddress,
  rowAddress,
  targetLabel,
  type Document,
  type LookLayer,
  type Preset,
  type PresetRow,
  type ValuePreset,
} from "@refrata/core";

import { formatTreeNodes, treeNodes } from "./tree-nodes.ts";
import { formatRowValue } from "./value-lines.ts";

/**
 * Presets as the CLI shows them: the tree of Groups with each Preset's
 * Elements counted, one Preset with its rows and the Look Layer rows
 * linked to it, and under a Look Layer the rows a Preset drives with what
 * each Element takes.
 */

/** A Look Layer row linked to a Preset, as `presets show` lists it. */
export interface LinkedRow {
  readonly address: string;
  /** "Spot · All Targets". */
  readonly owner: string;
  readonly attribute: string;
}

/** The Look Layer rows linked to `preset`, in no particular order. */
export function linkedRows(
  document: Document,
  preset: ValuePreset,
): readonly LinkedRow[] {
  return Object.values(document.links).flatMap((link) => {
    if (!isPresetLink(link) || link.presetId !== preset.id) return [];
    const resolved = resolveAddress(document, link.address);
    return [
      {
        address: link.address,
        owner: resolved?.owner ?? link.address,
        attribute: link.address.split("/").at(-1) ?? "",
      },
    ];
  });
}

function describeRows(
  document: Document,
  preset: ValuePreset,
  ref: string,
  rows: Readonly<Record<string, PresetRow>>,
): string {
  const entries = Object.entries(rows).map(([attribute, row]) => {
    const link = linkAt(document, presetRowAddress(preset.id, ref, attribute));
    const source =
      link === undefined
        ? ""
        : ` (controlled by ${linkSourceName(document, link)})`;
    return `${attribute} ${formatRowValue(attribute, row.value)}${source}`;
  });
  return entries.length === 0 ? "no rows" : entries.join(", ");
}

function describePreset(preset: Preset): string {
  const head = `“${preset.name}”  ${preset.id}`;
  if (preset.kind === "group") return `Group ${head}`;
  const count = preset.elements.length;
  return `Preset ${head}  ${String(count)} ${count === 1 ? "Element" : "Elements"}`;
}

/** Presets in their Groups, one line each. */
export function formatPresets(document: Document): string[] {
  return formatTreeNodes(treeNodes(document.presets), describePreset);
}

/** One Preset: its All Elements rows, each Element's rows, and the rows linked to it. */
export function formatPreset(
  document: Document,
  preset: ValuePreset,
): string[] {
  const lines = [
    describePreset(preset),
    `  ${ALL_ELEMENTS_LABEL}: ${describeRows(document, preset, ALL_TARGETS_REF, preset.all)}`,
    ...preset.elements.map(
      (ref) =>
        `  ${targetLabel(document, ref)}  ${ref}: ${describeRows(document, preset, ref, preset.rows[ref] ?? {})}`,
    ),
  ];
  const linked = linkedRows(document, preset);
  lines.push(
    linked.length === 0
      ? "  linked to no row"
      : `  linked to ${String(linked.length)} ${linked.length === 1 ? "row" : "rows"}:`,
    ...linked.map((row) => `    ${row.address}  ${row.owner}`),
  );
  return lines;
}

/**
 * The rows of one row ref of a Look Layer that a Preset drives, as lines
 * for `layers`: the Attributes with their Preset, then what each Element
 * the row reaches takes, an Element the Preset has nothing for saying so.
 */
export function presetRowLines(
  document: Document,
  layer: LookLayer,
  ref: string,
  label: string,
): string[] {
  const prefix = rowAddress(layer.id, ref, "");
  const lines: string[] = [];
  for (const link of linksUnder(document.links, prefix)) {
    const preset = presetOfLink(document, link);
    const attribute = link.address.slice(prefix.length);
    if (preset === undefined || !isAttributeKey(attribute)) continue;
    const entries = presetRowValues(document, layer, ref, attribute, preset)
      .map(
        (entry) =>
          `${entry.label} ${entry.value === undefined ? "no entry" : formatRowValue(attribute, entry.value)}`,
      )
      .join(", ");
    lines.push(
      `${label}: ${attribute} from Preset “${preset.name}”${entries === "" ? "" : ` (${entries})`}`,
    );
  }
  return lines.sort();
}
