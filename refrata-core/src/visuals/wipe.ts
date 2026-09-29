import { envelopeParameters } from "./envelope-parameters.ts";
import { bandLevel, defineGeometryVisual, rectPath } from "./geometry-sdk.ts";
import {
  booleanParam,
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
    "A band of color crosses the Frame, all the time or once per Cue; Targets outside the band are released.",
  slots: [
    { key: "color", label: "Color", kind: "color", attribute: "color" },
    { key: "level", label: "Level", kind: "number", attribute: "dimmer" },
  ],
  parameters: {
    ...envelopeParameters,
    rate: {
      kind: "number",
      label: "Rate",
      description:
        "Crossings of the Frame per second; how fast a Go crosses too.",
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
    automatic: {
      kind: "boolean",
      label: "Automatic",
      description:
        "Cross all the time; off writes nothing until a Go Cue, which crosses once.",
      default: true,
    },
    run: {
      kind: "choice",
      label: "Run",
      description:
        "Bounce turns at the edges; Forward and Backward cross and start over. With Automatic off, Bounce crosses the other way on each Go.",
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
    {
      key: "go",
      label: "Go",
      description:
        "With Automatic off, cross once; sat out while the band is still crossing.",
    },
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
    let go = false;
    /** With Automatic off: how far the crossing a Go began has come, and whether it runs backwards. */
    let crossing: { phase: number; backward: boolean } | undefined;
    let lastBackward = true;
    return {
      cue(key) {
        if (key === "sync") phase = 0;
        if (key === "go") go = true;
      },
      pose: () => ({ centre }),
      update({ dt, params, targets, width }, emit) {
        const rate = numberParam(params, "rate", 0.5);
        const half = numberParam(params, "width", 0.25) / 2;
        const softness = numberParam(params, "softness", 0.5);
        const run = choiceParam(params, "run", "forward");
        if (booleanParam(params, "automatic", true)) {
          crossing = undefined;
          phase = (phase + rate * dt) % 1;
          centre = wipeCentre(phase, half, run);
        } else {
          if (crossing !== undefined) crossing.phase += rate * dt;
          if (crossing !== undefined && crossing.phase >= 1)
            crossing = undefined;
          if (go && crossing === undefined) {
            lastBackward =
              run === "bounce" ? !lastBackward : run === "backward";
            crossing = { phase: 0, backward: lastBackward };
          }
          go = false;
          // The band waits outside the Frame, past the edge it left by.
          centre = wipeCentre(
            crossing?.phase ?? 1,
            half,
            (crossing?.backward ?? lastBackward) ? "backward" : "forward",
          );
          if (crossing === undefined) return;
        }
        go = false;
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
