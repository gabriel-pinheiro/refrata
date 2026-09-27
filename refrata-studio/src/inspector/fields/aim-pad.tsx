import type { NumberBounds } from "@refrata/core";
import { Move } from "lucide-react";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  formatDegrees,
  padStep,
  type AimAxisKey,
  type AimValue,
} from "./aim-nudge";

/** Where a value sits across its limits, 0 to 1, for the pad's marker. */
function across(value: number, limits: NumberBounds): number {
  const span = limits.max - limits.min;
  if (span <= 0) return 0.5;
  return Math.min(1, Math.max(0, (value - limits.min) / span));
}

/**
 * The Aim's pad, in a popover: a surface that works like a trackpad, so a
 * drag moves the Aim by how far the pointer travels (`aim.padDegreesPerPx`,
 * scaled by shift and ctrl as the arrow keys are) and never jumps to where
 * it was pressed. Right is more pan, up is more tilt. The marker shows where
 * the Aim sits within its limits; the arrow keys work here too.
 */
export function AimPad({
  label,
  shown,
  limits,
  free,
  onMove,
  onKeyDown,
}: {
  readonly label: string;
  readonly shown: AimValue;
  readonly limits: Readonly<Record<AimAxisKey, NumberBounds>>;
  readonly free: Readonly<Record<AimAxisKey, boolean>>;
  readonly onMove: (delta: AimValue) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const last = useRef<{ x: number; y: number } | undefined>(undefined);
  const movable = free.pan || free.tilt;
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!movable || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    last.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const from = last.current;
    if (from === undefined) return;
    last.current = { x: event.clientX, y: event.clientY };
    const step = padStep(event);
    const delta: AimValue = {
      ...(free.pan ? { pan: (event.clientX - from.x) * step } : {}),
      ...(free.tilt ? { tilt: (from.y - event.clientY) * step } : {}),
    };
    if (delta.pan !== 0 || delta.tilt !== 0) onMove(delta);
  };
  const end = (): void => {
    last.current = undefined;
  };
  const x = shown.pan === undefined ? 0.5 : across(shown.pan, limits.pan);
  const y = shown.tilt === undefined ? 0.5 : across(shown.tilt, limits.tilt);
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${label} pad`}
        title="Pad"
        disabled={!movable}
        className="grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-input/50 hover:text-foreground disabled:opacity-40"
      >
        <Move className="size-3" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto gap-2">
        <div
          role="application"
          aria-label={`${label} pad`}
          tabIndex={0}
          className={cn(
            "relative size-44 touch-none rounded-md border bg-input/20 outline-none select-none focus-visible:ring-1 focus-visible:ring-ring",
            movable ? "cursor-move" : "cursor-not-allowed",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={end}
          onPointerCancel={end}
          onKeyDown={onKeyDown}
        >
          <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
          <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
          <span
            className="absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-selection"
            style={{
              left: `${String(x * 100)}%`,
              bottom: `${String(y * 100)}%`,
            }}
          />
        </div>
        <div className="flex justify-between gap-3 text-[0.6875rem] text-muted-foreground tabular-nums">
          <span>
            Pan{" "}
            {shown.pan === undefined
              ? "released"
              : `${formatDegrees(shown.pan)}°`}
          </span>
          <span>
            Tilt{" "}
            {shown.tilt === undefined
              ? "released"
              : `${formatDegrees(shown.tilt)}°`}
          </span>
        </div>
        <p className="text-[0.625rem] text-muted-foreground/70">
          Drag to nudge. Shift coarse, ctrl fine.
        </p>
      </PopoverContent>
    </Popover>
  );
}
