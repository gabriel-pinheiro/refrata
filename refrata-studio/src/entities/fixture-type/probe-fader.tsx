import { segmentAt, wireBytes, type ChannelRow } from "@refrata/core";
import { memo, useState } from "react";

import { Slider } from "@/components/ui/slider";
import { useLatestWins } from "@/lib/use-latest-wins";
import { cn } from "@/lib/utils";

/**
 * One Channel's probe fader: the whole width of the Channel, 0 to 255 or
 * 0 to 65535 for two bytes, with the bytes it puts on the wire and the
 * range its top byte falls in.
 */
export const ProbeFader = memo(function ProbeFader({
  row,
  value,
  onChange,
  className,
}: {
  readonly row: ChannelRow;
  readonly value: number;
  readonly onChange: (row: ChannelRow, value: number) => void;
  readonly className?: string;
}) {
  const [dragged, setDragged] = useState<number | undefined>(undefined);
  const send = useLatestWins((next: number) => {
    onChange(row, next);
    return Promise.resolve();
  });
  const shown = dragged ?? value;
  const top = 256 ** row.bytes - 1;
  const now = segmentAt(row, shown);
  return (
    <div className={cn("flex min-w-0 items-center gap-2 text-xs", className)}>
      <Slider
        aria-label={`Probe ${row.name}`}
        className="min-w-16 flex-1"
        min={0}
        max={top}
        step={1}
        value={shown}
        onValueChange={(next) => {
          const picked = typeof next === "number" ? next : (next[0] ?? 0);
          setDragged(picked);
          send(picked);
        }}
        onValueCommitted={() => setDragged(undefined)}
      />
      <span className="shrink-0 text-right tabular-nums">
        {String(shown)}
        {row.bytes > 1 && (
          <span className="ml-1 text-muted-foreground">
            bytes {wireBytes(row.bytes, shown).join(" ")}
          </span>
        )}
        {now !== undefined && (
          <span className="ml-1.5 text-muted-foreground">{now.label}</span>
        )}
      </span>
    </div>
  );
});
