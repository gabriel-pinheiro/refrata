import { keyFromName, rangeClashes } from "@refrata/core";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import { NumberBox, TextBox } from "@/inspector/fields/form-inputs";

export interface RangeRow {
  readonly label: string;
  /** Absent for a row that claims no bytes yet, such as a value a `spread` leaves alone. */
  readonly bytes?: readonly [number, number] | undefined;
  /** `#rrggbb`, for a swatch. */
  readonly color?: string;
  /** A key that stays whatever the label becomes: an option's value. Shown beside the label once the two differ, and always in its tooltip. */
  readonly fixed?: string;
}

export const toHex = (color: readonly number[]): string =>
  `#${color
    .slice(0, 3)
    .map((part) =>
      Math.round(part * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

export const fromHex = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16) / 255,
  Number.parseInt(hex.slice(3, 5), 16) / 255,
  Number.parseInt(hex.slice(5, 7), 16) / 255,
];

/**
 * Byte ranges as rows: a label, the first byte and the last. Rows that
 * overlap another are marked. `current` is the probe's byte,
 * which marks the row it falls in. Rows can be added and removed when the
 * caller allows, relabelled when `onLabel` is given, and switched on and
 * off when `onToggle` is.
 */
export function RangesTable({
  rows,
  title,
  current,
  addLabel,
  onBytes,
  onLabel,
  onColor,
  onToggle,
  onAdd,
  onRemove,
}: {
  readonly rows: readonly RangeRow[];
  readonly title: string;
  readonly current?: number | undefined;
  readonly addLabel?: string;
  readonly onBytes: (index: number, bytes: [number, number]) => void;
  readonly onLabel?: (index: number, label: string) => void;
  readonly onColor?: (index: number, hex: string) => void;
  readonly onToggle?: (index: number, on: boolean) => void;
  readonly onAdd?: (() => void) | undefined;
  /** Absent when rows cannot be removed, such as the last one left. */
  readonly onRemove?: ((index: number) => void) | undefined;
}) {
  const ranges = rows.map((row) => row.bytes);
  const lead =
    (onToggle === undefined ? 0 : 1) + (onColor === undefined ? 0 : 1);
  const columns = `${"1.25rem ".repeat(lead)}minmax(0,1fr) 3rem 3rem${onRemove === undefined ? "" : " 1.25rem"}`;
  return (
    <div className="grid min-w-0 gap-1">
      <div
        className="grid items-center gap-1 text-[0.625rem] text-muted-foreground"
        style={{ gridTemplateColumns: columns }}
      >
        {lead > 0 && <span style={{ gridColumn: `span ${String(lead)}` }} />}
        <span>{title}</span>
        <span className="text-center">From</span>
        <span className="text-center">To</span>
      </div>
      {rows.map((row, index) => {
        const bad = rangeClashes(ranges, index);
        const here =
          current !== undefined &&
          row.bytes !== undefined &&
          current >= row.bytes[0] &&
          current <= row.bytes[1];
        return (
          <div
            key={index}
            className={cn(
              "grid items-center gap-1 rounded-sm",
              here && "bg-selection/15 outline outline-selection/70",
            )}
            style={{ gridTemplateColumns: columns }}
            title={bad ? "Overlaps another range" : undefined}
          >
            {onToggle !== undefined && (
              <Checkbox
                aria-label={`Use ${row.label}`}
                checked={row.bytes !== undefined}
                onCheckedChange={(on) => onToggle(index, on)}
              />
            )}
            {onColor !== undefined && (
              <input
                type="color"
                aria-label={`Colour of ${row.label}`}
                className="size-5 cursor-pointer rounded-sm border bg-transparent p-0"
                value={row.color ?? "#ffffff"}
                onChange={(event) => onColor(index, event.currentTarget.value)}
              />
            )}
            {onLabel === undefined ? (
              <span className="truncate text-xs">{row.label}</span>
            ) : (
              <span
                className="flex min-w-0 items-center gap-1.5"
                title={
                  row.fixed === undefined
                    ? undefined
                    : `Its value, ${row.fixed}, stays when the label changes`
                }
              >
                <TextBox
                  label={title}
                  className="flex-1"
                  value={row.label}
                  onChange={(label) => onLabel(index, label)}
                />
                {row.fixed !== undefined &&
                  row.fixed !== keyFromName(row.label) && (
                    <span className="max-w-[40%] shrink-0 truncate font-mono text-[0.625rem] text-muted-foreground">
                      {row.fixed}
                    </span>
                  )}
              </span>
            )}
            {row.bytes === undefined ? (
              <span className="col-span-2 text-center text-[0.6875rem] text-muted-foreground/70">
                writes nothing
              </span>
            ) : (
              <>
                <NumberBox
                  label={`${row.label} from`}
                  className={cn(bad && "border-destructive text-destructive")}
                  value={row.bytes[0]}
                  onChange={(from) =>
                    onBytes(index, [Math.round(from), row.bytes?.[1] ?? 255])
                  }
                />
                <NumberBox
                  label={`${row.label} to`}
                  className={cn(bad && "border-destructive text-destructive")}
                  value={row.bytes[1]}
                  onChange={(to) =>
                    onBytes(index, [row.bytes?.[0] ?? 0, Math.round(to)])
                  }
                />
              </>
            )}
            {onRemove !== undefined && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${row.label}`}
                onClick={() => onRemove(index)}
              >
                <X />
              </Button>
            )}
          </div>
        );
      })}
      {addLabel !== undefined && (
        <Button
          variant="outline"
          size="xs"
          className="mt-0.5 w-fit"
          disabled={onAdd === undefined}
          title={onAdd === undefined ? "The last range ends at 255" : undefined}
          onClick={onAdd}
        >
          <Plus /> {addLabel}
        </Button>
      )}
    </div>
  );
}
