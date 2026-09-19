import { settings } from "../settings.ts";
import { envelopeParameters, envelopeSlots } from "./envelope-parameters.ts";
import {
  colorParam,
  defineVisual,
  numberParam,
  RATE_MAX_HZ,
  WHITE,
  type VisualTarget,
} from "./sdk.ts";

interface Envelope {
  level: number;
  stage: "in" | "hold" | "out";
  /** Seconds left of the hold. */
  held: number;
}

export const shimmer = defineVisual({
  id: "shimmer",
  name: "Shimmer",
  description: "Random Targets sparkle and return to the look below.",
  slots: envelopeSlots("color"),
  parameters: {
    ...envelopeParameters,
    count: {
      kind: "number",
      label: "Count",
      description: "Targets picked by each firing.",
      min: 1,
      max: 64,
      step: 1,
      default: 1,
    },
    fadeIn: {
      kind: "number",
      label: "Fade in",
      min: 0,
      max: 5_000,
      step: 1,
      unit: "ms",
      default: 50,
    },
    hold: {
      kind: "number",
      label: "Hold",
      min: 0,
      max: 5_000,
      step: 1,
      unit: "ms",
      default: 50,
    },
    fadeOut: {
      kind: "number",
      label: "Fade out",
      min: 0,
      max: 5_000,
      step: 1,
      unit: "ms",
      default: 300,
    },
    rate: {
      kind: "number",
      label: "Rate",
      description: "Firings per second; 0 leaves it to the Fire Cue.",
      min: 0,
      max: RATE_MAX_HZ,
      unit: "Hz",
      default: 4,
    },
    jitter: {
      kind: "number",
      label: "Jitter",
      description: "0 fires evenly, 100 % at random intervals.",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 1,
    },
  },
  cues: [
    { key: "fire", label: "Fire", description: "Sparkle Count Targets now." },
  ],
  distributes: true,
  create({ random }) {
    const envelopes = new Map<string, Envelope>();
    let pending = 0;
    /** Seconds until the next automatic firing; undefined while the rate is 0. */
    let next: number | undefined;

    const interval = (rate: number, jitter: number): number => {
      const exponential = -Math.log(1 - random());
      return (1 - jitter + jitter * exponential) / rate;
    };

    const fire = (targets: readonly VisualTarget[], count: number): void => {
      const idle = targets.filter((target) => !envelopes.has(target.key));
      const busy = targets.filter((target) => envelopes.has(target.key));
      for (let picked = 0; picked < count; picked += 1) {
        const pool = idle.length > 0 ? idle : busy;
        if (pool.length === 0) return;
        const [target] = pool.splice(Math.floor(random() * pool.length), 1);
        if (target === undefined) return;
        const current = envelopes.get(target.key);
        envelopes.set(target.key, {
          level: current?.level ?? 0,
          stage: "in",
          held: 0,
        });
      }
    };

    return {
      cue(key) {
        if (key === "fire") pending += 1;
      },
      update({ dt, params, targets }, emit) {
        const fadeIn = numberParam(params, "fadeIn", 50) / 1_000;
        const hold = numberParam(params, "hold", 50) / 1_000;
        const fadeOut = numberParam(params, "fadeOut", 300) / 1_000;
        const rate = numberParam(params, "rate", 4);
        const jitter = numberParam(params, "jitter", 1);
        let firings = pending;
        pending = 0;
        if (rate <= 0) next = undefined;
        else {
          next = (next ?? interval(rate, jitter)) - dt;
          while (next <= 0 && firings < settings.visuals.maxFiringsPerFrame) {
            firings += 1;
            next += interval(rate, jitter);
          }
          if (next <= 0) next = interval(rate, jitter);
        }
        const count = Math.round(numberParam(params, "count", 1));
        for (let firing = 0; firing < firings; firing += 1)
          fire(targets, count);

        // A Target fired this frame starts rising in it, so a Cue shows at once.
        for (const [key, envelope] of envelopes) {
          if (envelope.stage === "in") {
            envelope.level = fadeIn <= 0 ? 1 : envelope.level + dt / fadeIn;
            if (envelope.level >= 1) {
              envelope.level = 1;
              envelope.stage = "hold";
              envelope.held = hold;
            }
          } else if (envelope.stage === "hold") {
            envelope.held -= dt;
            if (envelope.held <= 0) envelope.stage = "out";
          } else {
            envelope.level = fadeOut <= 0 ? 0 : envelope.level - dt / fadeOut;
            if (envelope.level <= 0) envelopes.delete(key);
          }
        }

        const color = colorParam(params, "color", WHITE);
        const level = numberParam(params, "level", 1);
        for (const target of targets) {
          const envelope = envelopes.get(target.key);
          if (envelope === undefined || envelope.level <= 0) continue;
          emit("color", target, color, envelope.level);
          emit("level", target, level, envelope.level);
        }
      },
    };
  },
});
