import type { DocumentView } from "@refrata/client";
import { channelLabel, type OccupiedAddress } from "@refrata/core";
import type { MouseEvent } from "react";

import { cn } from "@/lib/utils";

import { useFrameByte } from "./use-frame";

/** The two tints neighbouring Fixtures alternate between, so where one ends and the next starts is visible. */
const TONES = [
  {
    cell: "border-sky-500/40 bg-sky-500/15",
    bar: "bg-sky-400/40",
  },
  {
    cell: "border-fuchsia-500/40 bg-fuchsia-500/15",
    bar: "bg-fuchsia-400/40",
  },
] as const;

/**
 * One DMX Address of the grid. A patched address is tinted by its Fixture
 * with a bar rising with its byte, and shows the Channel's name, the
 * address and the byte; the Fixture's name runs over the first cells of
 * its row when `labelSpan` is above zero. A free address is dashed and
 * shows its byte only when the DMX Tester forces one. Clicking a patched
 * address selects its Fixture.
 */
export function AddressCell({
  view,
  universeId,
  address,
  occupied,
  tone,
  labelSpan,
  held,
  selected,
  onSelect,
}: {
  readonly view: DocumentView;
  readonly universeId: string;
  readonly address: number;
  readonly occupied: OccupiedAddress | undefined;
  readonly tone: number;
  readonly labelSpan: number;
  readonly held: boolean;
  readonly selected: boolean;
  readonly onSelect: (fixtureId: string, event: MouseEvent) => void;
}) {
  const byte = useFrameByte(view, universeId, address);
  const shown = byte === undefined ? "" : String(byte);
  if (occupied === undefined)
    return (
      <div
        className="relative h-10 rounded-sm border border-dashed border-border/60"
        title={`${String(address)}, free`}
      >
        <Corner held={held} />
        <span className="absolute bottom-0.5 left-1 text-[0.5625rem] text-muted-foreground/60 tabular-nums">
          {address}
        </span>
        {byte !== undefined && byte > 0 && (
          <span className="absolute right-1 bottom-0.5 text-[0.6875rem] font-medium text-amber-400 tabular-nums">
            {shown}
          </span>
        )}
      </div>
    );
  const tint = TONES[tone % TONES.length] ?? TONES[0];
  const label = channelLabel(occupied);
  return (
    <button
      type="button"
      className={cn(
        "relative h-10 rounded-sm border text-left",
        tint.cell,
        selected && "outline-1 -outline-offset-1 outline-foreground",
      )}
      title={`${occupied.fixture.name}\n${label} (${occupied.mode.name})\naddresses ${String(occupied.start)} to ${String(occupied.end)}`}
      onClick={(event) => onSelect(occupied.fixture.id, event)}
    >
      <span
        className={cn("absolute inset-x-0 bottom-0 rounded-b-sm", tint.bar)}
        style={{ height: `${String(((byte ?? 0) / 255) * 100)}%` }}
      />
      <Corner held={held} />
      {labelSpan > 0 && (
        <span
          className="absolute top-0.5 left-1 z-10 truncate text-[0.5625rem] font-semibold"
          style={{
            width: `calc(${String(labelSpan * 100)}% + ${String(labelSpan - 1)}px - 0.5rem)`,
          }}
        >
          {occupied.fixture.name}
        </span>
      )}
      <span className="absolute top-3.5 left-1 max-w-[calc(100%-0.5rem)] truncate text-[0.5625rem] text-foreground/80">
        {label}
      </span>
      <span className="absolute bottom-0.5 left-1 text-[0.5625rem] text-muted-foreground tabular-nums">
        {address}
      </span>
      <span className="absolute right-1 bottom-0.5 text-[0.6875rem] font-medium tabular-nums">
        {shown}
      </span>
    </button>
  );
}

/** The amber corner of an address the DMX Tester is forcing. */
function Corner({ held }: { readonly held: boolean }) {
  if (!held) return null;
  return (
    <span
      className="absolute top-0 right-0 border-t-[7px] border-l-[7px] border-t-amber-400 border-l-transparent"
      title="Forced by the DMX Tester"
    />
  );
}
