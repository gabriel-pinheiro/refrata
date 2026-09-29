import { defineVisual, numberParam, regionSlot } from "./sdk.ts";

type Point = readonly [number, number];

/** One mover's wander, in fractions of the Region: where it left, where it is going and how long ago it left. */
interface Wander {
  from: Point;
  to: Point;
  /** Seconds since the move began. */
  moved: number;
  /** Seconds until its next move by the Rate; at or under 0 it is due. */
  wait: number;
  /** Whether the move under way came from the Next Cue, which a move by the Rate waits for. */
  cued: boolean;
}

/** Slow off the mark and slow into the stop, as a mover settles. */
const ease = (t: number): number => t * t * (3 - 2 * t);

export const ballyhoo = defineVisual({
  id: "ballyhoo",
  name: "Ballyhoo",
  description:
    "Every mover wanders to random positions of its own inside the Region, the searchlight look; at a rate or on a Cue.",
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
      description: "Moves per second; 0 leaves it to the Next Cue.",
      min: 0,
      max: 5,
      step: 0.05,
      unit: "Hz",
      default: 0.5,
    },
    variance: {
      kind: "number",
      label: "Variance",
      description:
        "How far the wait before each move strays from the Rate's; 0 keeps every wait alike.",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0.3,
    },
    travel: {
      kind: "number",
      label: "Travel",
      description: "Seconds each move takes; 0 jumps.",
      min: 0,
      max: 30,
      step: 0.1,
      unit: "s",
      default: 2,
    },
  },
  cues: [
    {
      key: "next",
      label: "Next",
      description: "Send every mover somewhere new now, to arrive together.",
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
        const rate = numberParam(params, "rate", 0.5);
        const variance = numberParam(params, "variance", 0.3);
        const travel = numberParam(params, "travel", 2);
        const pick = (): Point => [random(), random()];
        const place = (wander: Wander): Point => {
          const t = ease(travel <= 0 ? 1 : Math.min(1, wander.moved / travel));
          return [
            wander.from[0] + (wander.to[0] - wander.from[0]) * t,
            wander.from[1] + (wander.to[1] - wander.from[1]) * t,
          ];
        };
        const leave = (wander: Wander, cued: boolean): void => {
          wander.from = place(wander);
          wander.to = pick();
          wander.moved = 0;
          wander.cued = cued;
        };
        const seen = new Set<string>();
        for (const target of targets) {
          seen.add(target.key);
          let wander = wanders.get(target.key);
          if (wander === undefined) {
            const at = pick();
            // Each mover starts its own clock so they never move in step.
            wander = {
              from: at,
              to: at,
              moved: 0,
              wait: rate > 0 ? random() / rate : 0,
              cued: false,
            };
            wanders.set(target.key, wander);
          }
          wander.moved += dt;
          if (rate > 0) {
            const longest = (1 + variance) / rate;
            wander.wait = Math.min(wander.wait, longest) - dt;
            const travelling = wander.cued && wander.moved < travel;
            if (wander.wait <= 0 && !travelling) {
              leave(wander, false);
              const waited = (1 + variance * (2 * random() - 1)) / rate;
              // A move held back by a cued one keeps its clock; one too late starts a new wait.
              wander.wait += waited;
              if (wander.wait <= 0) wander.wait = waited;
            }
          }
          if (next) leave(wander, true);
          const [x, y] = place(wander);
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
