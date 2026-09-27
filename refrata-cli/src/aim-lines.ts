import {
  effectiveValue,
  linkAt,
  outOfReach,
  reachLimits,
  resolveAddress,
  rowAddress,
  rowReach,
  rowRefLabel,
  settings,
  storedRow,
  type Document,
  type LookLayer,
  type NumberBounds,
  type ReachedRange,
} from "@refrata/core";

export const AIM_AXES = ["pan", "tilt"] as const;
export type AimAxisKey = (typeof AIM_AXES)[number];

/** One axis of a Look Layer row ref's Aim as the CLI reports it. */
export interface AimAxisReport {
  readonly axis: AimAxisKey;
  readonly address: string;
  /** The stored degrees; undefined while the row is released. */
  readonly value: number | undefined;
  /** The Controller driving the axis, by name, when linked. */
  readonly controlledBy: string | undefined;
  /** What the axis sends: the Controller's value when linked, else the stored one. */
  readonly effective: number | undefined;
  /** What it is nudged within: the widest range of the Elements it reaches. */
  readonly limits: NumberBounds;
  readonly reach: readonly ReachedRange[];
  /** The reached Elements that cannot go to the effective value. */
  readonly beyond: readonly ReachedRange[];
}

/** The Aim of one row ref of a Look Layer, axis by axis. */
export function aimReport(
  document: Document,
  layer: LookLayer,
  ref: string,
): readonly AimAxisReport[] {
  return AIM_AXES.map((axis) => {
    const address = rowAddress(layer.id, ref, axis);
    const resolved = resolveAddress(document, address);
    if (resolved?.type !== "number")
      throw new Error(
        `${rowRefLabel(document, ref)} on “${layer.name}” has no ${axis === "pan" ? "Pan" : "Tilt"}, so it has no Aim.`,
      );
    const stored = storedRow(layer, ref, axis)?.value;
    const value = typeof stored === "number" ? stored : undefined;
    const link = linkAt(document, address);
    const effective =
      link === undefined ? value : effectiveValue(document, resolved);
    const reach = rowReach(document, layer, ref, axis);
    return {
      axis,
      address,
      value,
      controlledBy:
        link === undefined
          ? undefined
          : (document.controllers[link.controllerId]?.name ??
            link.controllerId),
      effective: typeof effective === "number" ? effective : undefined,
      limits: reachLimits(reach, resolved.range ?? { min: 0, max: 0 }),
      reach,
      beyond: typeof effective === "number" ? outOfReach(reach, effective) : [],
    };
  });
}

const degrees = (value: number): string =>
  `${value.toFixed(settings.aim.decimals)}°`;

const span = (range: NumberBounds): string =>
  `${degrees(range.min)} to ${degrees(range.max)}`;

/**
 * An Aim as lines: a heading, then each axis with its degrees (or released,
 * or the Controller driving it), the limits it is nudged within, and the
 * reached Elements it is beyond.
 */
export function formatAim(
  document: Document,
  layer: LookLayer,
  ref: string,
  report: readonly AimAxisReport[],
): string[] {
  const lines = [`Aim of ${rowRefLabel(document, ref)} on “${layer.name}”`];
  for (const axis of report) {
    const shown =
      axis.effective === undefined ? "released" : degrees(axis.effective);
    const source =
      axis.controlledBy === undefined
        ? ""
        : `, controlled by ${axis.controlledBy}`;
    lines.push(
      `  ${axis.axis.padEnd(4)}  ${shown}${source}  (within ${span(axis.limits)})`,
    );
    for (const range of axis.beyond)
      lines.push(
        `    warning: beyond ${range.label}, which reaches ${span(range)}`,
      );
  }
  return lines;
}
