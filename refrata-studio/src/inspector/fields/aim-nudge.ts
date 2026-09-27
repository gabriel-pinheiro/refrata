import { settings, type NumberBounds } from "@refrata/core";

/** The two axes of an Aim. */
export type AimAxisKey = "pan" | "tilt";

/** Degrees for either or both axes: what one edit of an Aim writes. */
export type AimValue = Partial<Record<AimAxisKey, number>>;

interface Modifiers {
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

/** Degrees one nudge moves: `aim.nudge`, coarser with shift, finer with ctrl (cmd on macOS). */
export function nudgeStep(modifiers: Modifiers): number {
  if (modifiers.ctrlKey || modifiers.metaKey) return settings.aim.nudgeFine;
  if (modifiers.shiftKey) return settings.aim.nudgeCoarse;
  return settings.aim.nudge;
}

/** Degrees one pixel of drag on the pad moves, scaled by the modifiers as a key's nudge is. */
export function padStep(modifiers: Modifiers): number {
  return (
    (settings.aim.padDegreesPerPx * nudgeStep(modifiers)) / settings.aim.nudge
  );
}

/** What an arrow key does to an Aim: left and right move pan, up and down move tilt. */
export function arrowNudge(
  key: string,
  step: number,
): { readonly axis: AimAxisKey; readonly delta: number } | undefined {
  switch (key) {
    case "ArrowLeft":
      return { axis: "pan", delta: -step };
    case "ArrowRight":
      return { axis: "pan", delta: step };
    case "ArrowUp":
      return { axis: "tilt", delta: step };
    case "ArrowDown":
      return { axis: "tilt", delta: -step };
    default:
      return undefined;
  }
}

/** A typed number of degrees, clamped to the limits; undefined when it is not a number. */
export function parseDegrees(
  text: string,
  limits: NumberBounds,
): number | undefined {
  const typed = Number(text.trim().replace(/°$/, ""));
  if (text.trim() === "" || !Number.isFinite(typed)) return undefined;
  return Math.min(limits.max, Math.max(limits.min, typed));
}

/** Degrees as an Aim readout shows them, `aim.decimals` places. */
export function formatDegrees(value: number): string {
  return value.toFixed(settings.aim.decimals);
}
