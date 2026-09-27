import {
  effectiveValue,
  getAtPath,
  linkAt,
  linkSourceName,
  outOfReach,
  presetOfLink,
  presetRefLabel,
  presetRowAddress,
  presetRowValues,
  reachLimits,
  addressReach,
  resolveAddress,
  rowAddress,
  rowRefLabel,
  settings,
  type Document,
  type LookLayer,
  type NumberBounds,
  type PresetEntry,
  type ReachedRange,
  type ValuePreset,
} from "@refrata/core";

export const AIM_AXES = ["pan", "tilt"] as const;
export type AimAxisKey = (typeof AIM_AXES)[number];

/** What holds an Aim: a row ref of a Look Layer, or of a Preset. */
export type AimOwner =
  | { readonly layer: LookLayer; readonly ref: string }
  | { readonly preset: ValuePreset; readonly ref: string };

/** One axis of an Aim as the CLI reports it. */
export interface AimAxisReport {
  readonly axis: AimAxisKey;
  readonly address: string;
  /** The stored degrees; undefined while the row is released. */
  readonly value: number | undefined;
  /** Who drives the axis when linked: a Controller's name, or "Preset “Table”". */
  readonly controlledBy: string | undefined;
  /** What the axis sends: the Controller's value when linked, else the stored one; none when a Preset drives it, which has one per Element. */
  readonly effective: number | undefined;
  /** Linked to a Preset: what each Element the row reaches takes from it, `value` absent where the Preset has no entry. */
  readonly entries?: readonly PresetEntry[];
  /** What it is clamped and nudged within: the widest range of the Elements it reaches. */
  readonly limits: NumberBounds;
  readonly reach: readonly ReachedRange[];
  /** The reached Elements that cannot go to the effective value. */
  readonly beyond: readonly ReachedRange[];
}

/** "All Targets on “Base”", "Left on Preset “Table”". */
export function ownerLabel(document: Document, owner: AimOwner): string {
  return "layer" in owner
    ? `${rowRefLabel(document, owner.ref)} on “${owner.layer.name}”`
    : `${presetRefLabel(document, owner.ref)} on Preset “${owner.preset.name}”`;
}

function axisAddress(owner: AimOwner, axis: AimAxisKey): string {
  return "layer" in owner
    ? rowAddress(owner.layer.id, owner.ref, axis)
    : presetRowAddress(owner.preset.id, owner.ref, axis);
}

/** The Aim of one row ref of a Look Layer or of a Preset, axis by axis. */
export function aimReport(
  document: Document,
  owner: AimOwner,
): readonly AimAxisReport[] {
  return AIM_AXES.map((axis) => {
    const address = axisAddress(owner, axis);
    const resolved = resolveAddress(document, address);
    if (resolved?.type !== "number")
      throw new Error(
        `${ownerLabel(document, owner)} has no ${axis === "pan" ? "Pan" : "Tilt"}, so it has no Aim.`,
      );
    const stored = getAtPath(document, resolved.path);
    const value = typeof stored === "number" ? stored : undefined;
    const link = linkAt(document, address);
    const preset =
      link === undefined ? undefined : presetOfLink(document, link);
    const effective =
      link === undefined
        ? value
        : preset === undefined
          ? effectiveValue(document, resolved)
          : undefined;
    const reach = addressReach(document, address);
    return {
      axis,
      address,
      value,
      controlledBy:
        link === undefined ? undefined : linkSourceName(document, link),
      effective: typeof effective === "number" ? effective : undefined,
      ...(preset !== undefined && "layer" in owner
        ? {
            entries: presetRowValues(
              document,
              owner.layer,
              owner.ref,
              axis,
              preset,
            ),
          }
        : {}),
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
 * or who drives it), the limits it is nudged within, the reached Elements
 * it is beyond and, linked to a Preset, what each Element takes from it.
 */
export function formatAim(
  document: Document,
  owner: AimOwner,
  report: readonly AimAxisReport[],
): string[] {
  const lines = [`Aim of ${ownerLabel(document, owner)}`];
  for (const axis of report) {
    const shown =
      axis.entries !== undefined
        ? `linked to ${axis.controlledBy ?? "a Preset"}`
        : axis.effective === undefined
          ? "released"
          : `${degrees(axis.effective)}${axis.controlledBy === undefined ? "" : `, controlled by ${axis.controlledBy}`}`;
    lines.push(
      `  ${axis.axis.padEnd(4)}  ${shown}  (within ${span(axis.limits)})`,
    );
    const width = Math.max(
      0,
      ...(axis.entries ?? []).map((entry) => entry.label.length),
    );
    for (const entry of axis.entries ?? [])
      lines.push(
        `    ${entry.label.padEnd(width)}  ${typeof entry.value === "number" ? degrees(entry.value) : "no entry, released"}`,
      );
    for (const range of axis.beyond)
      lines.push(
        `    warning: beyond ${range.label}, which reaches ${span(range)}`,
      );
  }
  return lines;
}
