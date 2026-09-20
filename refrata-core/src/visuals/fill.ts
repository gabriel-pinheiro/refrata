import type { Color, ParameterSchema } from "../parameters.ts";
import { mixColor, WHITE, type Emit, type VisualTarget } from "./sdk.ts";

/** What one step of a fill shows this frame. */
export interface FillLook {
  /** How lit the step is, 0 to 1. */
  alpha: number;
  /** How much of its color is still the white it arrived with. */
  flash: number;
}

/**
 * The fill the counting Visuals (Meter, Counter, Timer) share. Targets are
 * walked in the steps of `chaseSteps` (one Target each going forward, pairs
 * from the centre out), `goal` says how many steps are lit and a fraction
 * lights the next one partly. A step that comes on arrives in a style: at once, fading,
 * flashing white and settling, or dropping in from the far end to stack on
 * the ones already lit. Going down always fades over the same time.
 */
export function createFill() {
  let levels: number[] = [];
  let flashes: number[] = [];
  let drops: { readonly to: number; progress: number }[] = [];

  return {
    reset(): void {
      levels = [];
      flashes = [];
      drops = [];
    },
    step(
      dt: number,
      steps: number,
      goal: number,
      style: string,
      seconds: number,
    ): FillLook[] {
      levels = Array.from({ length: steps }, (_, step) => levels[step] ?? 0);
      flashes = Array.from({ length: steps }, (_, step) => flashes[step] ?? 0);
      drops = drops.filter((drop) => drop.to < steps);
      const instant = style === "cut" || seconds <= 0;
      const travel = instant ? 1 : dt / seconds;
      const wantedAt = (step: number) => Math.min(1, Math.max(0, goal - step));

      for (let step = 0; step < steps; step += 1) {
        const current = levels[step] ?? 0;
        const wanted = wantedAt(step);
        if (wanted > current) {
          if (instant) levels[step] = wanted;
          else if (style === "fade")
            levels[step] = Math.min(wanted, current + travel);
          else if (style === "flash") {
            if (current <= 0) flashes[step] = 1;
            levels[step] = wanted;
          } else if (current > 0) levels[step] = wanted;
          else if (!drops.some((drop) => drop.to === step))
            drops.push({ to: step, progress: 0 });
        } else if (wanted < current) {
          levels[step] = instant ? wanted : Math.max(wanted, current - travel);
          if (wanted <= 0) drops = drops.filter((drop) => drop.to !== step);
        }
        flashes[step] = Math.max(0, (flashes[step] ?? 0) - travel);
      }

      const looks = levels.map((alpha, step) => ({
        alpha,
        flash: flashes[step] ?? 0,
      }));
      for (const drop of drops) {
        drop.progress += travel;
        if (drop.progress >= 1) {
          levels[drop.to] = wantedAt(drop.to);
          const landed = looks[drop.to];
          if (landed !== undefined) landed.alpha = levels[drop.to] ?? 0;
          continue;
        }
        // It falls from the far end, gathering speed.
        const at = steps - 1 + (drop.to - (steps - 1)) * drop.progress ** 2;
        for (const near of [Math.floor(at), Math.ceil(at)]) {
          const look = looks[near];
          if (look !== undefined)
            look.alpha = Math.max(look.alpha, 1 - Math.abs(near - at));
        }
      }
      drops = drops.filter((drop) => drop.progress < 1);
      return looks;
    },
  };
}

/** Writes a fill's looks to the `color` and `level` Slots of the Targets each step lights. */
export function emitFill(
  emit: Emit,
  targets: readonly VisualTarget[],
  steps: readonly (readonly number[])[],
  looks: readonly FillLook[],
  colorOf: (step: number) => Color,
  level: number,
  dim = 1,
): void {
  looks.forEach((look, step) => {
    if (look.alpha <= 0) return;
    const color = mixColor(colorOf(step), WHITE, look.flash);
    for (const index of steps[step] ?? []) {
      const target = targets[index];
      if (target === undefined) continue;
      emit("color", target, color, look.alpha * dim);
      emit("level", target, level, look.alpha * dim);
    }
  });
}

export const fillSlots = [
  { key: "color", label: "Color", kind: "color", attribute: "color" },
  { key: "level", label: "Level", kind: "number", attribute: "dimmer" },
] as const;

export const fillOrder = {
  kind: "choice",
  label: "Order",
  description: "Where the fill starts.",
  default: "forward",
  options: [
    { value: "forward", label: "Forward" },
    { value: "backward", label: "Backward" },
    { value: "center-out", label: "Center out" },
    { value: "ends-in", label: "Ends in" },
  ],
} as const;

export function arriveParameters(style: string, ms: number) {
  return {
    arrive: {
      kind: "choice",
      label: "Arrive",
      description: "How a step comes on.",
      default: style,
      options: [
        { value: "cut", label: "Cut" },
        { value: "fade", label: "Fade" },
        { value: "flash", label: "Flash white" },
        { value: "drop", label: "Drop in" },
      ],
    },
    arriveTime: {
      kind: "number",
      label: "Arrive time",
      min: 0,
      max: 5_000,
      step: 1,
      unit: "ms",
      default: ms,
    },
  } as const satisfies ParameterSchema;
}
