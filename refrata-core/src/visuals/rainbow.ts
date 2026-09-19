import type { Color } from "../parameters.ts";
import { defineVisual, numberParam, RATE_MAX_HZ } from "./sdk.ts";

/** A colour from a hue of 0 to 1 and a saturation, at full value. */
export function hueColor(hue: number, saturation: number): Color {
  const h = (hue - Math.floor(hue)) * 6;
  const x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] =
    h < 1
      ? [1, x, 0]
      : h < 2
        ? [x, 1, 0]
        : h < 3
          ? [0, 1, x]
          : h < 4
            ? [0, x, 1]
            : h < 5
              ? [x, 0, 1]
              : [1, 0, x];
  const white = 1 - saturation;
  return [
    white + saturation * r,
    white + saturation * g,
    white + saturation * b,
    1,
  ];
}

export const rainbow = defineVisual({
  id: "rainbow",
  name: "Rainbow",
  description: "The spectrum laid across the Targets, travelling.",
  slots: [{ key: "color", label: "Color", kind: "color", attribute: "color" }],
  parameters: {
    rate: {
      kind: "number",
      label: "Rate",
      description: "Whole turns of the spectrum per second.",
      min: 0,
      max: RATE_MAX_HZ,
      unit: "Hz",
      default: 0.2,
    },
    hueSpread: {
      kind: "number",
      label: "Hue spread",
      description: "Spectra from the first Target to the last.",
      min: 0,
      max: 4,
      default: 1,
    },
    saturation: {
      kind: "number",
      label: "Saturation",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 1,
    },
  },
  cues: [{ key: "sync", label: "Sync", description: "Restart from red." }],
  distributes: true,
  create() {
    let phase = 0;
    return {
      cue(key) {
        if (key === "sync") phase = 0;
      },
      update({ dt, params, targets }, emit) {
        phase += numberParam(params, "rate", 0.2) * dt;
        const spread = numberParam(params, "hueSpread", 1);
        const saturation = numberParam(params, "saturation", 1);
        for (const target of targets)
          emit(
            "color",
            target,
            hueColor(
              phase - (spread * target.index) / target.count,
              saturation,
            ),
          );
      },
    };
  },
});
