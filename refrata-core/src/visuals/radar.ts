import { envelopeParameters } from "./envelope-parameters.ts";
import {
  bandLevel,
  defineGeometryVisual,
  halfDiagonal,
  wedgePath,
} from "./geometry-sdk.ts";
import {
  choiceParam,
  colorParam,
  numberParam,
  RATE_MAX_HZ,
  WHITE,
} from "./sdk.ts";

/** The shortest turn between two angles, degrees, 0 to 180. */
export function angleBetween(a: number, b: number): number {
  const difference = Math.abs(((a - b) % 360) + 360) % 360;
  return difference > 180 ? 360 - difference : difference;
}

export const radar = defineGeometryVisual({
  id: "radar",
  name: "Radar",
  description:
    "A wedge of color turns about the Frame's centre; Targets outside the wedge are released.",
  slots: [
    { key: "color", label: "Color", kind: "color", attribute: "color" },
    { key: "level", label: "Level", kind: "number", attribute: "dimmer" },
  ],
  parameters: {
    ...envelopeParameters,
    rate: {
      kind: "number",
      label: "Rate",
      description: "Turns per second.",
      min: 0,
      max: RATE_MAX_HZ,
      step: 0.01,
      unit: "Hz",
      default: 0.25,
    },
    angle: {
      kind: "number",
      label: "Angle",
      description: "How wide the wedge is.",
      min: 1,
      max: 180,
      step: 1,
      unit: "°",
      default: 30,
    },
    softness: {
      kind: "number",
      label: "Softness",
      description: "How much of the wedge's edge ramps instead of cutting.",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0.5,
    },
    direction: {
      kind: "choice",
      label: "Direction",
      default: "clockwise",
      options: [
        { value: "clockwise", label: "Clockwise" },
        { value: "counterclockwise", label: "Counterclockwise" },
      ],
    },
  },
  cues: [{ key: "sync", label: "Sync", description: "Back to pointing up." }],
  distributes: true,
  figure(params, pose, size) {
    const half = numberParam(params, "angle", 30) / 2;
    const heading = typeof pose.heading === "number" ? pose.heading : 90;
    return [
      {
        d: wedgePath(heading - half, heading + half, halfDiagonal(size)),
        alpha: 0.25,
        color: colorParam(params, "color", WHITE),
      },
    ];
  },
  create() {
    /** Degrees counterclockwise from the Frame's right, as the audience sees it. */
    let heading = 90;
    return {
      cue(key) {
        if (key === "sync") heading = 90;
      },
      pose: () => ({ heading }),
      update({ dt, params, targets }, emit) {
        const turn = numberParam(params, "rate", 0.25) * dt * 360;
        const clockwise =
          choiceParam(params, "direction", "clockwise") === "clockwise";
        heading = (((heading + (clockwise ? -turn : turn)) % 360) + 360) % 360;
        const half = numberParam(params, "angle", 30) / 2;
        const softness = numberParam(params, "softness", 0.5);
        const color = colorParam(params, "color", WHITE);
        const level = numberParam(params, "level", 1);
        for (const target of targets) {
          // The centre itself has no direction, so the wedge always covers it.
          const distance =
            Math.hypot(target.x, target.y) < 1e-6
              ? 0
              : angleBetween(
                  (Math.atan2(target.y, target.x) * 180) / Math.PI,
                  heading,
                );
          const envelope = bandLevel(distance, half, softness);
          if (envelope <= 0) continue;
          emit("color", target, color, envelope);
          emit("level", target, level, envelope);
        }
      },
    };
  },
});
