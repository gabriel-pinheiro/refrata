import type { Color } from "../parameters.ts";
import type { Swatch } from "./fixture-type.ts";

/**
 * A discrete gamut: the swatches of a colour wheel. A colour asked of a
 * wheel lands on the swatch nearest in hue, brightness set aside, so a
 * fading Rainbow keeps its slot instead of drifting to the darkest one,
 * and black or grey, having no hue, land on the white slot. The
 * brightness set aside is the colour's largest component, what an RGB
 * fixture would drive its emitter at, and it multiplies the dimmer at
 * Encoding so a dim red on a wheel is a dim red.
 */
export function brightnessOf(color: Color): number {
  const [r, g, b] = color;
  return Math.max(r, g, b);
}

/** The swatch nearest in hue to `color`; the first one when the gamut is empty is never asked for. */
export function nearestSwatch(
  color: Color,
  swatches: readonly Swatch[],
): Swatch | undefined {
  const asked = hueOf(color);
  let best: Swatch | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const swatch of swatches) {
    const [r, g, b] = hueOf([...swatch.color, 1]);
    const distance =
      (asked[0] - r) ** 2 + (asked[1] - g) ** 2 + (asked[2] - b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = swatch;
    }
  }
  return best;
}

/** `color` as the wheel will show it: the nearest swatch's colour at the asked brightness, alpha kept. */
export function snapToGamut(color: Color, swatches: readonly Swatch[]): Color {
  const swatch = nearestSwatch(color, swatches);
  if (swatch === undefined) return color;
  const brightness = brightnessOf(color);
  const [r, g, b] = swatch.color;
  return [r * brightness, g * brightness, b * brightness, color[3]];
}

/** A colour scaled so its largest component is 1; black and grey become white. */
function hueOf(color: Color): readonly [number, number, number] {
  const [r, g, b] = color;
  const max = Math.max(r, g, b);
  if (max <= 0) return [1, 1, 1];
  return [r / max, g / max, b / max];
}
