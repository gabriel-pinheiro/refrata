import { settings } from "../settings.ts";
import { envelopeParameters } from "./envelope-parameters.ts";
import {
  bandLevel,
  circlePath,
  defineGeometryVisual,
  halfDiagonal,
} from "./geometry-sdk.ts";
import {
  choiceParam,
  colorParam,
  numberParam,
  RATE_MAX_HZ,
  WHITE,
} from "./sdk.ts";

export const ripple = defineGeometryVisual({
  id: "ripple",
  name: "Ripple",
  description:
    "Rings of color spread from the Frame's centre, or close in on it; Targets between rings are released.",
  slots: [
    { key: "color", label: "Color", kind: "color", attribute: "color" },
    { key: "level", label: "Level", kind: "number", attribute: "dimmer" },
  ],
  parameters: {
    ...envelopeParameters,
    rate: {
      kind: "number",
      label: "Rate",
      description: "Rings launched per second; 0 leaves it to the Fire Cue.",
      min: 0,
      max: RATE_MAX_HZ,
      step: 0.01,
      unit: "Hz",
      default: 1,
    },
    travel: {
      kind: "number",
      label: "Travel",
      description:
        "Seconds a ring takes from the centre to the Frame's corners.",
      min: 0.1,
      max: 30,
      step: 0.1,
      unit: "s",
      default: 1.5,
    },
    width: {
      kind: "number",
      label: "Width",
      description:
        "A ring's thickness, as a fraction of the way from the centre to a corner.",
      min: 0.01,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0.2,
    },
    softness: {
      kind: "number",
      label: "Softness",
      description: "How much of a ring's edge ramps instead of cutting.",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0.5,
    },
    direction: {
      kind: "choice",
      label: "Direction",
      default: "outward",
      options: [
        { value: "outward", label: "Outward" },
        { value: "inward", label: "Inward" },
      ],
    },
  },
  cues: [{ key: "fire", label: "Fire", description: "Launch one ring now." }],
  distributes: true,
  figure(params, pose, size) {
    const reach = halfDiagonal(size);
    const width = numberParam(params, "width", 0.2) * reach;
    const color = colorParam(params, "color", WHITE);
    const radii = Array.isArray(pose.radii) ? pose.radii : [];
    return radii.map((radius) => ({
      d: circlePath(Math.max(radius * reach, width / 2)),
      alpha: 0.25,
      color,
      strokeWidth: width,
    }));
  },
  create() {
    /** Each ring's progress from 0 (centre) to 1 (corners), whatever its direction. */
    let rings: number[] = [];
    let pending = 0;
    /** Seconds until the next automatic launch; undefined while the rate is 0. */
    let next: number | undefined;
    let inward = false;
    return {
      cue(key) {
        if (key === "fire") pending += 1;
      },
      pose: () => ({
        radii: rings.map((progress) => (inward ? 1 - progress : progress)),
      }),
      update({ dt, params, targets, width, height }, emit) {
        const rate = numberParam(params, "rate", 1);
        const travel = numberParam(params, "travel", 1.5);
        let launches = pending;
        pending = 0;
        if (rate <= 0) next = undefined;
        else {
          next = (next ?? 1 / rate) - dt;
          while (next <= 0 && launches < settings.visuals.maxFiringsPerFrame) {
            launches += 1;
            next += 1 / rate;
          }
          if (next <= 0) next = 1 / rate;
        }
        inward = choiceParam(params, "direction", "outward") === "inward";
        const halfBand = numberParam(params, "width", 0.2) / 2;
        rings = rings
          .map((progress) => progress + dt / travel)
          .filter((progress) => progress <= 1 + halfBand);
        for (let launch = 0; launch < launches; launch += 1) rings.push(0);

        const reach = halfDiagonal({ width, height });
        const softness = numberParam(params, "softness", 0.5);
        const color = colorParam(params, "color", WHITE);
        const level = numberParam(params, "level", 1);
        for (const target of targets) {
          const distance = Math.hypot(target.x, target.y) / reach;
          let envelope = 0;
          for (const progress of rings) {
            const radius = inward ? 1 - progress : progress;
            envelope = Math.max(
              envelope,
              bandLevel(Math.abs(distance - radius), halfBand, softness),
            );
          }
          if (envelope <= 0) continue;
          emit("color", target, color, envelope);
          emit("level", target, level, envelope);
        }
      },
    };
  },
});
