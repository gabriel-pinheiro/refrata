import { envelopeParameters } from "./envelope-parameters.ts";
import { bandLevel, defineGeometryVisual, rectPath } from "./geometry-sdk.ts";
import {
  choiceParam,
  colorParam,
  numberParam,
  RATE_MAX_HZ,
  WHITE,
} from "./sdk.ts";

/** Where the band's centre line is, in fractions of the Frame's width from its left edge, for a phase of one crossing. */
export function wipeCentre(
  phase: number,
  halfWidth: number,
  run: string,
): number {
  if (run === "bounce") {
    const t = phase < 0.5 ? phase * 2 : 2 - phase * 2;
    return t;
  }
  // Forward and backward enter from outside the Frame and leave past its far edge.
  const across = -halfWidth + phase * (1 + 2 * halfWidth);
  return run === "backward" ? 1 - across : across;
}

export const wipe = defineGeometryVisual({
  id: "wipe",
  name: "Wipe",
  description:
    "A band of color crosses the Frame; Targets outside the band are released.",
  slots: [
    { key: "color", label: "Color", kind: "color", attribute: "color" },
    { key: "level", label: "Level", kind: "number", attribute: "dimmer" },
  ],
  parameters: {
    ...envelopeParameters,
    rate: {
      kind: "number",
      label: "Rate",
      description: "Crossings of the Frame per second.",
      min: 0,
      max: RATE_MAX_HZ,
      step: 0.01,
      unit: "Hz",
      default: 0.5,
    },
    width: {
      kind: "number",
      label: "Width",
      description: "The band, as a fraction of the Frame's width.",
      min: 0.01,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0.25,
    },
    softness: {
      kind: "number",
      label: "Softness",
      description: "How much of the band's edge ramps instead of cutting.",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0.5,
    },
    run: {
      kind: "choice",
      label: "Run",
      description:
        "Bounce turns at the edges; Forward and Backward cross and start over.",
      default: "forward",
      options: [
        { value: "forward", label: "Forward" },
        { value: "backward", label: "Backward" },
        { value: "bounce", label: "Bounce" },
      ],
    },
  },
  cues: [
    { key: "sync", label: "Sync", description: "Restart from the first edge." },
  ],
  distributes: true,
  figure(params, pose, size) {
    const half = numberParam(params, "width", 0.25) / 2;
    const centre = typeof pose.centre === "number" ? pose.centre : 0;
    return [
      {
        d: rectPath(
          (centre - 0.5) * size.width,
          0,
          half * 2 * size.width,
          size.height,
        ),
        alpha: 0.25,
        color: colorParam(params, "color", WHITE),
      },
    ];
  },
  create() {
    let phase = 0;
    let centre = 0;
    return {
      cue(key) {
        if (key === "sync") phase = 0;
      },
      pose: () => ({ centre }),
      update({ dt, params, targets, width }, emit) {
        phase = (phase + numberParam(params, "rate", 0.5) * dt) % 1;
        const half = numberParam(params, "width", 0.25) / 2;
        const softness = numberParam(params, "softness", 0.5);
        const run = choiceParam(params, "run", "forward");
        centre = wipeCentre(phase, half, run);
        const color = colorParam(params, "color", WHITE);
        const level = numberParam(params, "level", 1);
        for (const target of targets) {
          const along = target.x / width + 0.5;
          const envelope = bandLevel(Math.abs(along - centre), half, softness);
          if (envelope <= 0) continue;
          emit("color", target, color, envelope);
          emit("level", target, level, envelope);
        }
      },
    };
  },
});
