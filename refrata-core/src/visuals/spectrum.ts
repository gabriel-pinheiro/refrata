import { defineGeometryVisual, rectPath } from "./geometry-sdk.ts";
import { hueColor } from "./rainbow.ts";
import { numberParam, RATE_MAX_HZ } from "./sdk.ts";

/** Strips the figure paints the spectrum with, across the Frame. */
const STRIPS = 24;

/** The hue at `along` (0 at the Frame's left edge, 1 at its right, clamped past them) for a phase and a spread. */
export function spectrumHue(
  along: number,
  phase: number,
  spread: number,
): number {
  return phase - spread * Math.min(1, Math.max(0, along));
}

export const spectrum = defineGeometryVisual({
  id: "spectrum",
  name: "Spectrum",
  description:
    "The spectrum laid across the Frame by position, travelling; past its edges the edge colour holds.",
  slots: [{ key: "color", label: "Color", kind: "color", attribute: "color" }],
  parameters: {
    rate: {
      kind: "number",
      label: "Rate",
      description: "Whole turns of the spectrum per second.",
      min: 0,
      max: RATE_MAX_HZ,
      step: 0.01,
      unit: "Hz",
      default: 0.2,
    },
    hueSpread: {
      kind: "number",
      label: "Hue spread",
      description: "Spectra from the Frame's left edge to its right.",
      min: 0,
      max: 4,
      step: 0.01,
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
  figure(params, pose, size) {
    const phase = typeof pose.phase === "number" ? pose.phase : 0;
    const spread = numberParam(params, "hueSpread", 1);
    const saturation = numberParam(params, "saturation", 1);
    const stripWidth = size.width / STRIPS;
    return Array.from({ length: STRIPS }, (_, index) => {
      const along = (index + 0.5) / STRIPS;
      return {
        d: rectPath((along - 0.5) * size.width, 0, stripWidth, size.height),
        alpha: 0.25,
        color: hueColor(spectrumHue(along, phase, spread), saturation),
      };
    });
  },
  create() {
    let phase = 0;
    return {
      cue(key) {
        if (key === "sync") phase = 0;
      },
      pose: () => ({ phase }),
      update({ dt, params, targets, width }, emit) {
        phase = (phase + numberParam(params, "rate", 0.2) * dt) % 1;
        const spread = numberParam(params, "hueSpread", 1);
        const saturation = numberParam(params, "saturation", 1);
        for (const target of targets)
          emit(
            "color",
            target,
            hueColor(
              spectrumHue(target.x / width + 0.5, phase, spread),
              saturation,
            ),
          );
      },
    };
  },
});
