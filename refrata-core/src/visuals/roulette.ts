import { wave } from "./lfo.ts";
import { colorParam, defineVisual, numberParam, WHITE } from "./sdk.ts";

/** How long the Target it lands on blinks before it holds, and how fast. */
const LANDED_BLINK_SECONDS = 1.5;
const LANDED_BLINK_HZ = 4;

export const roulette = defineVisual({
  id: "roulette",
  name: "Roulette",
  description: "A light runs along the Targets, slows down and lands on one.",
  slots: [
    { key: "color", label: "Color", kind: "color", attribute: "color" },
    { key: "level", label: "Level", kind: "number", attribute: "dimmer" },
  ],
  parameters: {
    color: { kind: "color", label: "Color", default: WHITE },
    level: {
      kind: "number",
      label: "Level",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 1,
    },
    duration: {
      kind: "number",
      label: "Duration",
      min: 0.5,
      max: 60,
      step: 0.1,
      unit: "s",
      default: 5,
    },
    laps: {
      kind: "number",
      label: "Laps",
      description: "Whole passes before it lands.",
      min: 0,
      max: 20,
      step: 1,
      default: 3,
    },
    winner: {
      kind: "number",
      label: "Winner",
      description:
        "The Target it lands on, counted from 1; 0 picks one at random.",
      min: 0,
      max: 64,
      step: 1,
      default: 0,
    },
    tail: {
      kind: "number",
      label: "Tail",
      description: "Targets glowing behind the light.",
      min: 0,
      max: 8,
      step: 1,
      default: 1,
    },
  },
  cues: [
    { key: "spin", label: "Spin", description: "Run and land on a Target." },
    { key: "clear", label: "Clear", description: "Let go of every Target." },
  ],
  distributes: true,
  create({ random }) {
    /** Where the latest spin started and how far it runs, in Targets; undefined before the first. */
    let spin: { from: number; distance: number; elapsed: number } | undefined;
    let pending: string[] = [];
    return {
      cue(key) {
        pending.push(key);
      },
      update({ dt, params, targets }, emit) {
        const count = targets.length;
        for (const key of pending) {
          if (key === "clear") spin = undefined;
          if (key === "spin" && count > 0) {
            const from =
              spin === undefined ? 0 : (spin.from + spin.distance) % count;
            const chosen = Math.round(numberParam(params, "winner", 0));
            const winner =
              chosen > 0
                ? Math.min(count, chosen) - 1
                : Math.floor(random() * count);
            const laps = Math.round(numberParam(params, "laps", 3));
            spin = {
              from,
              distance: laps * count + ((winner - from + count) % count),
              elapsed: 0,
            };
          }
        }
        pending = [];
        if (spin === undefined || count === 0) return;
        spin.elapsed += dt;
        const duration = numberParam(params, "duration", 5);
        const done = Math.min(1, spin.elapsed / duration);
        // Fast off the mark and ever slower, so the last Targets tick by one at a time.
        const travelled = Math.floor(
          spin.distance * (1 - (1 - done) ** 3) + 1e-9,
        );
        const tail = done >= 1 ? 0 : Math.round(numberParam(params, "tail", 1));
        const blink =
          done >= 1 && spin.elapsed - duration < LANDED_BLINK_SECONDS
            ? wave("square", (spin.elapsed - duration) * LANDED_BLINK_HZ)
            : 1;
        const color = colorParam(params, "color", WHITE);
        const level = numberParam(params, "level", 1);
        for (let age = 0; age <= Math.min(tail, travelled); age += 1) {
          const target = targets[(spin.from + travelled - age) % count];
          const alpha = (1 - age / (tail + 1)) * blink;
          if (target === undefined || alpha <= 0) continue;
          emit("color", target, color, alpha);
          emit("level", target, level, alpha);
        }
      },
    };
  },
});
