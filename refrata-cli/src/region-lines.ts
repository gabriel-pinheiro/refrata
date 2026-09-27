import {
  linkAt,
  linkSourceName,
  REGION_AXES,
  REGION_FORM_LABELS,
  regionAim,
  regionAimLabel,
  regionAimNames,
  regionFlags,
  regionLimits,
  regionPlace,
  regionPreset,
  regionPresetValues,
  settings,
  visualDefinition,
  type Document,
  type NumberBounds,
  type PresetEntry,
  type Region,
  type RegionAimName,
  type RegionAxis,
  type RegionFlag,
  type VisualLayer,
} from "@refrata/core";

/** One axis of one Aim of a Region as the CLI reports it. */
export interface RegionAxisReport {
  readonly axis: RegionAxis;
  /** What a Preset Link names to drive it; not an Address. */
  readonly place: string;
  /** The typed degrees, which a Link leaves in place under it. */
  readonly value: number;
  /** "Preset “Table”" when linked. */
  readonly controlledBy: string | undefined;
  /** Linked: what each Element the Layer reaches takes, `value` absent where the Preset has no entry. */
  readonly entries?: readonly PresetEntry[];
  /** What a typed value is held within. */
  readonly limits: NumberBounds;
}

export interface RegionAimReport {
  readonly aim: RegionAimName;
  /** "From", "To", "Center", or "Offset" on the Blend Mode add. */
  readonly label: string;
  readonly axes: readonly RegionAxisReport[];
}

export interface RegionReport {
  readonly layerId: string;
  readonly region: Region;
  readonly aims: readonly RegionAimReport[];
  /** The ends of the box an Element cannot go to. */
  readonly flags: readonly RegionFlag[];
}

/** The Region of a Layer, Aim by Aim, or undefined when it has none. */
export function regionReport(
  document: Document,
  layer: VisualLayer,
): RegionReport | undefined {
  const region = layer.region;
  if (region === undefined) return undefined;
  return {
    layerId: layer.id,
    region,
    aims: regionAimNames(region.form).map((aim) => ({
      aim,
      label: regionAimLabel(aim, layer.blendMode),
      axes: REGION_AXES.map((axis) => {
        const place = regionPlace(layer.id, aim, axis);
        const link = linkAt(document, place);
        const preset = regionPreset(document, layer.id, aim, axis);
        return {
          axis,
          place,
          value: regionAim(region, aim)?.[axis] ?? 0,
          controlledBy:
            link === undefined ? undefined : linkSourceName(document, link),
          ...(preset === undefined
            ? {}
            : {
                entries: regionPresetValues(document, layer, axis, preset),
              }),
          limits: regionLimits(document, layer, axis),
        };
      }),
    })),
    flags: regionFlags(document, layer, region),
  };
}

const degrees = (value: number): string =>
  `${value.toFixed(settings.aim.decimals)}°`;

/** `corners, from -30.0°/-30.0° to 30.0°/60.0°`, pan before tilt; a linked Aim names its Preset instead. */
export function describeRegion(document: Document, layer: VisualLayer): string {
  const report = regionReport(document, layer);
  if (report === undefined) return "none";
  const aims = report.aims.map((aim) => {
    const [pan, tilt] = aim.axes.map(
      (axis) => axis.controlledBy ?? degrees(axis.value),
    );
    const both = pan === tilt ? (pan ?? "") : `${pan ?? ""}/${tilt ?? ""}`;
    return `${aim.label.toLowerCase()} ${both}`;
  });
  const { region } = report;
  return region.form === "corners"
    ? `corners, ${aims.join(" ")}`
    : `${aims.join("")}, ${degrees(region.width)} wide, ${degrees(region.height)} high`;
}

/**
 * A Region as lines: a heading with its form, each Aim axis by axis with
 * its degrees or the Preset that drives it and what each Element takes,
 * the size of one by center, and the ends an Element cannot go to.
 */
export function formatRegion(
  document: Document,
  layer: VisualLayer,
  report: RegionReport,
): string[] {
  const visual = visualDefinition(layer.visual)?.name ?? layer.visual;
  const lines = [
    `Region of “${layer.name}” (${visual}), by ${REGION_FORM_LABELS[report.region.form].toLowerCase()}${layer.blendMode === "add" ? ", on Add: an offset from what is below" : ""}`,
  ];
  for (const aim of report.aims) {
    lines.push(`  ${aim.label.toLowerCase()}`);
    for (const axis of aim.axes) {
      const limits = `(within ${degrees(axis.limits.min)} to ${degrees(axis.limits.max)})`;
      lines.push(
        axis.controlledBy === undefined
          ? `    ${axis.axis.padEnd(4)}  ${degrees(axis.value)}  ${limits}`
          : `    ${axis.axis.padEnd(4)}  linked to ${axis.controlledBy}`,
      );
      const width = Math.max(
        0,
        ...(axis.entries ?? []).map((entry) => entry.label.length),
      );
      for (const entry of axis.entries ?? [])
        lines.push(
          `      ${entry.label.padEnd(width)}  ${typeof entry.value === "number" ? degrees(entry.value) : "no entry, released"}`,
        );
    }
  }
  if (report.region.form === "center")
    lines.push(
      `  size  ${degrees(report.region.width)} wide, ${degrees(report.region.height)} high`,
    );
  for (const flag of report.flags)
    lines.push(
      `  warning: ${flag.label} cannot go to ${flag.axis} ${degrees(flag.value)}; it reaches ${degrees(flag.min)} to ${degrees(flag.max)}`,
    );
  return lines;
}
