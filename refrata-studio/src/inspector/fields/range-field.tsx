import type { NumberRange } from "@refrata/core";
import { useState } from "react";

import { Input } from "@/components/ui/input";

import { displayUnit, formatNumber, parseNumber } from "./address-format";

/**
 * The two ends of a range inside `bounds`, in the bounds' own display (a
 * percent range reads 0 to 100): each end edits locally and commits on blur
 * or Enter, clamped to the bounds; Escape puts the stored value back. The
 * first end above the second is fine and means inverted.
 */
export function RangeField({
  label,
  bounds,
  from,
  to,
  onCommit,
}: {
  /** Names the pair to assistive technology, such as "Range of Value on Dimmer". */
  readonly label: string;
  readonly bounds: NumberRange;
  readonly from: number;
  readonly to: number;
  readonly onCommit: (ends: {
    readonly from: number;
    readonly to: number;
  }) => void;
}) {
  const unit = displayUnit(bounds);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
      <End
        label={`${label}, at 0`}
        bounds={bounds}
        value={from}
        onCommit={(value) => onCommit({ from: value, to })}
      />
      <span>to</span>
      <End
        label={`${label}, at 1`}
        bounds={bounds}
        value={to}
        onCommit={(value) => onCommit({ from, to: value })}
      />
      {unit !== "" && <span>{unit}</span>}
    </span>
  );
}

function End({
  label,
  bounds,
  value,
  onCommit,
}: {
  readonly label: string;
  readonly bounds: NumberRange;
  readonly value: number;
  readonly onCommit: (value: number) => void;
}) {
  const shown = formatNumber(value, bounds);
  const [text, setText] = useState<string | undefined>(undefined);
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      className="h-6 min-w-0 flex-1 px-1.5 text-right tabular-nums"
      value={text ?? shown}
      onFocus={(event) => {
        setText(shown);
        event.currentTarget.select();
      }}
      onChange={(event) => setText(event.currentTarget.value)}
      onBlur={() => {
        const parsed =
          text === undefined ? undefined : parseNumber(text, bounds);
        setText(undefined);
        if (parsed !== undefined && parsed !== value) onCommit(parsed);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setText(undefined);
          // Blur after the state is cleared, so nothing commits.
          const input = event.currentTarget;
          queueMicrotask(() => input.blur());
        }
      }}
    />
  );
}
