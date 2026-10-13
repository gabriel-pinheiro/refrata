import { cn } from "@/lib/utils";

import type { Segment } from "@refrata/core";

import { css } from "./summaries";

const HATCH =
  "repeating-linear-gradient(135deg, transparent 0 4px, oklch(1 0 0 / 0.06) 4px 5px)";

function fill(segment: Segment, index: number): string {
  const even = index % 2 === 0;
  switch (segment.kind) {
    case "swatch":
      return segment.color === undefined ? "white" : css(segment.color);
    case "mix":
      return `linear-gradient(to right, oklch(0.2 0 0), ${segment.color === undefined ? "white" : css(segment.color)})`;
    case "scale":
      return "linear-gradient(to right, oklch(0.24 0.01 264), oklch(0.8 0.01 264))";
    case "option":
      return even ? "oklch(0.44 0.05 248)" : "oklch(0.54 0.06 248)";
    case "spread":
      return even ? "oklch(0.42 0.09 300)" : "oklch(0.52 0.1 300)";
    case "switch":
      return segment.label === "On"
        ? "oklch(0.62 0.13 160)"
        : "oklch(0.32 0.01 264)";
  }
}

/**
 * A Channel's 256 bytes as one bar: each range drawn where it sits, bytes
 * nothing claims hatched. `focus` names the Parameter being edited, whose
 * ranges stay bright while the others dim; `value` puts a marker at a byte.
 */
export function ByteBar({
  segments,
  value,
  focus,
  className,
}: {
  readonly segments: readonly Segment[];
  readonly value?: number | undefined;
  readonly focus?:
    { readonly element: string; readonly attribute: string } | undefined;
  readonly className?: string;
}) {
  const percent = (bytes: number): string => `${String((bytes / 256) * 100)}%`;
  return (
    <div
      className={cn(
        "relative h-5 w-full min-w-0 overflow-hidden rounded-sm border bg-muted/40",
        className,
      )}
      style={{ backgroundImage: HATCH }}
    >
      {segments.map((segment, index) => {
        const size = segment.to - segment.from + 1;
        return (
          <div
            key={`${segment.element}:${segment.attribute}:${String(segment.from)}:${String(index)}`}
            title={`${segment.parameter}: ${segment.label}, ${String(segment.from)} to ${String(segment.to)}`}
            className={cn(
              "absolute inset-y-0 flex items-center overflow-hidden border-r border-background/60",
              focus !== undefined &&
                (focus.element !== segment.element ||
                  focus.attribute !== segment.attribute) &&
                "opacity-30",
            )}
            style={{
              background: fill(segment, index),
              left: percent(segment.from),
              width: percent(size),
            }}
          >
            {size >= 40 && (
              <span className="truncate px-1 text-[0.5625rem] font-medium text-white mix-blend-difference">
                {segment.label}
              </span>
            )}
          </div>
        );
      })}
      {value !== undefined && (
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_black]"
          style={{ left: percent(value + 0.5) }}
        />
      )}
    </div>
  );
}
