import { defineVisual, numberParam, regionSlot } from "./sdk.ts";

type Point = readonly [number, number];

/** One mover's wander, in fractions of the Region: where it left, where it is going and how far along. */
interface Wander {
  from: Point;
  to: Point;
  elapsed: number;
}

/** Slow off the mark and slow into the stop, as a mover settles. */
const ease = (t: number): number => t * t * (3 - 2 * t);

export const ballyhoo = defineVisual({
  id: "ballyhoo",
  name: "Ballyhoo",
  description:
    "Every mover wanders to random positions of its own inside the Region, the searchlight look.",
  slots: [regionSlot("x", "X", "pan"), regionSlot("y", "Y", "tilt")],
  region: {
    width: "x",
    height: "y",
    default: {
      form: "center",
      center: { pan: 0, tilt: 0 },
      width: 60,
      height: 30,
    },
  },
  parameters: {
    rate: {
      kind: "number",
      label: "Rate",
      description: "Moves per second.",
      min: 0.05,
      max: 5,
      step: 0.05,
      unit: "Hz",
      default: 0.5,
    },
    glide: {
      kind: "number",
      label: "Glide",
      description: "The part of each move spent travelling; 0 jumps.",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 1,
    },
  },
  cues: [
    {
      key: "next",
      label: "Next",
      description: "Send every mover somewhere new now.",
    },
  ],
  distributes: true,
  create({ random }) {
    const wanders = new Map<string, Wander>();
    let next = false;
    return {
      cue(key) {
        if (key === "next") next = true;
      },
      update({ dt, params, targets }, emit) {
        const interval = 1 / numberParam(params, "rate", 0.5);
        const glide = numberParam(params, "glide", 1);
        const pick = (): Point => [random(), random()];
        const seen = new Set<string>();
        for (const target of targets) {
          seen.add(target.key);
          let wander = wanders.get(target.key);
          if (wander === undefined) {
            // Each mover starts its own clock so they never move in step.
            wander = { from: pick(), to: pick(), elapsed: random() * interval };
            wanders.set(target.key, wander);
          }
          wander.elapsed += dt;
          while (wander.elapsed >= interval) {
            wander.from = wander.to;
            wander.to = pick();
            wander.elapsed -= interval;
          }
          const travel =
            glide <= 0 ? 1 : Math.min(1, wander.elapsed / (interval * glide));
          const t = ease(travel);
          const x = wander.from[0] + (wander.to[0] - wander.from[0]) * t;
          const y = wander.from[1] + (wander.to[1] - wander.from[1]) * t;
          if (next) {
            wander.from = [x, y];
            wander.to = pick();
            wander.elapsed = 0;
          }
          emit("x", target, x);
          emit("y", target, y);
        }
        next = false;
        for (const key of wanders.keys())
          if (!seen.has(key)) wanders.delete(key);
      },
    };
  },
});
