import {
  settings,
  type ParameterValue,
  type PresetEntry,
  type ResolvedAddress,
} from "@refrata/core";
import { TriangleAlert } from "lucide-react";

import { colorToHex, displayUnit, formatNumber } from "./address-format";
import { unitGap } from "./editable-readout";

/** One Element under a row a Preset drives: its name and what it takes, a part absent where the Preset has no entry for it. */
export interface ShownEntry {
  readonly ref: string;
  readonly label: string;
  /** What it takes, part by part: one for a row, pan then tilt for an Aim. */
  readonly parts: readonly (string | undefined)[];
}

/** A Preset's value as a row of `resolved` reads it: 40%, 12.5°, #00ff00, on, the option's label. */
export function entryText(
  resolved: ResolvedAddress,
  value: ParameterValue | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value ? "on" : "off";
  if (typeof value === "string")
    return (
      resolved.options?.find((option) => option.value === value)?.label ?? value
    );
  if (typeof value !== "number") return colorToHex(value).toUpperCase();
  const range = resolved.range ?? { min: 0, max: 1 };
  if (range.unit === "°") return `${value.toFixed(settings.aim.decimals)}°`;
  const unit = displayUnit(range);
  return `${formatNumber(value, range)}${unitGap(unit)}${unit}`;
}

/** Entries of one row as shown entries of one part each. */
export function shownEntries(
  resolved: ResolvedAddress,
  entries: readonly PresetEntry[],
): readonly ShownEntry[] {
  return entries.map((entry) => ({
    ref: entry.ref,
    label: entry.label,
    parts: [entryText(resolved, entry.value)],
  }));
}

/**
 * What each Element a row reaches takes from the Preset driving it, one
 * line each, and the Elements the Preset has nothing for, named, since
 * they are released.
 */
export function PresetEntries({
  label,
  entries,
}: {
  /** What the list belongs to, such as "Aim" or "Dimmer". */
  readonly label: string;
  readonly entries: readonly ShownEntry[];
}) {
  if (entries.length === 0) return null;
  const missing = entries.filter((entry) =>
    entry.parts.some((part) => part === undefined),
  );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
      <ul
        aria-label={`${label} by Element`}
        className="grid grid-cols-[minmax(0,1fr)] gap-px"
      >
        {entries.map((entry) => (
          <li
            key={entry.ref}
            className="flex items-baseline gap-2 text-[0.6875rem] text-muted-foreground"
          >
            <span className="min-w-0 flex-1 truncate" title={entry.label}>
              {entry.label}
            </span>
            {entry.parts.map((part, index) => (
              <span
                key={index}
                className={
                  part === undefined
                    ? "shrink-0 text-amber-300 italic"
                    : "shrink-0 text-foreground tabular-nums"
                }
              >
                {part ?? "no entry"}
              </span>
            ))}
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <p className="flex items-start gap-1 text-[0.625rem] text-amber-300">
          <TriangleAlert aria-hidden className="mt-px size-3 shrink-0" />
          <span>
            Released, no entry in the Preset:{" "}
            {missing.map((entry) => entry.label).join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}
