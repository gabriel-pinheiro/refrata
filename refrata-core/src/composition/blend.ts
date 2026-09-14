import type { Color, ParameterKind, ParameterValue } from "../parameters.ts";
import type { BlendMode } from "../document/composition.ts";

/**
 * How one Contribution combines with what is accumulated below it, per
 * Parameter kind, at an effective alpha `a` (the Contribution's alpha times
 * the Layer's opacity). Numbers and colours crossfade, add, multiply, or
 * lean toward the max or min; choices and booleans take the value from
 * alpha one half up, whatever the mode, since they cannot crossfade.
 */
export function blendValue(
  kind: ParameterKind,
  out: ParameterValue,
  value: ParameterValue,
  a: number,
  mode: BlendMode,
): ParameterValue {
  if (a <= 0) return out;
  switch (kind) {
    case "number":
      return typeof out === "number" && typeof value === "number"
        ? blendNumber(out, value, a, mode)
        : out;
    case "color":
      return Array.isArray(out) && Array.isArray(value)
        ? blendColor(out as Color, value as Color, a, mode)
        : out;
    case "choice":
    case "boolean":
      return a >= 0.5 ? value : out;
  }
}

export function blendNumber(
  out: number,
  value: number,
  a: number,
  mode: BlendMode,
): number {
  switch (mode) {
    case "normal":
      return out + (value - out) * a;
    case "add":
      return out + a * value;
    case "multiply":
      return out * (1 - a + a * value);
    case "max":
      return out + (Math.max(out, value) - out) * a;
    case "min":
      return out + (Math.min(out, value) - out) * a;
  }
}

/** Red, green and blue blend like numbers; the colour's own alpha stays what the stack had (Encoding ignores it). */
function blendColor(
  out: Color,
  value: Color,
  a: number,
  mode: BlendMode,
): Color {
  return [
    blendNumber(out[0], value[0], a, mode),
    blendNumber(out[1], value[1], a, mode),
    blendNumber(out[2], value[2], a, mode),
    out[3],
  ];
}
