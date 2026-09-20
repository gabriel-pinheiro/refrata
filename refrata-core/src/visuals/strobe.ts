import { envelopeParameters } from "./envelope-parameters.ts";
import { createPulses, pulseParameters } from "./pulses.ts";
import {
  booleanParam,
  colorParam,
  defineVisual,
  numberParam,
  WHITE,
} from "./sdk.ts";

export const strobe = defineVisual({
  id: "strobe",
  name: "Strobe",
  description: "Every Target flashes a color at a rate, or on a Cue.",
  slots: [
    { key: "color", label: "Color", kind: "color", attribute: "color" },
    { key: "level", label: "Level", kind: "number", attribute: "dimmer" },
  ],
  parameters: {
    ...envelopeParameters,
    run: {
      kind: "boolean",
      label: "Run",
      description: "Flash at the Rate all the time; off leaves it to the Cues.",
      default: true,
    },
    ...pulseParameters,
    flash: {
      kind: "number",
      label: "Flash",
      description: "How long a flash stays full.",
      min: 0,
      max: 1_000,
      step: 1,
      unit: "ms",
      default: 30,
    },
    fadeOut: {
      kind: "number",
      label: "Fade out",
      min: 0,
      max: 5_000,
      step: 1,
      unit: "ms",
      default: 0,
    },
    randomPhase: {
      kind: "boolean",
      label: "Random phase",
      description: "Each Target flashes on a beat of its own.",
      default: false,
    },
    burst: {
      kind: "number",
      label: "Burst",
      description: "Flashes the Burst Cue gives, at the Rate.",
      min: 1,
      max: 16,
      step: 1,
      default: 3,
    },
  },
  cues: [
    { key: "sync", label: "Sync", description: "Restart the beat now." },
    { key: "flash", label: "Flash", description: "One flash now." },
    { key: "burst", label: "Burst", description: "Burst flashes, then dark." },
  ],
  distributes: false,
  create({ random }) {
    const pulses = createPulses(random);
    let pending: string[] = [];
    /** Beats left to a burst's end, counted on the clock; 0 when none runs. */
    let burstBeats = 0;

    return {
      cue(key) {
        pending.push(key);
      },
      update({ dt, params, targets }, emit) {
        const run = booleanParam(params, "run", true);
        const rate = numberParam(params, "rate", 8);
        const how = {
          spread: numberParam(params, "phaseSpread", 0),
          random: booleanParam(params, "randomPhase", false),
        };
        let hit = false;
        for (const key of pending) {
          if (key === "sync") pulses.sync();
          if (key === "flash") hit = true;
          if (key === "burst") {
            if (rate <= 0) hit = true;
            else if (!run) {
              pulses.sync();
              burstBeats = Math.round(numberParam(params, "burst", 3));
            }
          }
        }
        pending = [];
        if (run) burstBeats = 0;
        const beating = run || burstBeats > 0;
        pulses.step(
          dt,
          beating ? rate : 0,
          targets,
          how,
          (beat) => run || beat < burstBeats,
        );
        if (hit) pulses.hit(targets);
        // The last Target of a spread burst is a cycle or more behind the first.
        const behind = how.random ? 1 : how.spread;
        if (burstBeats > 0 && pulses.phase >= burstBeats + behind)
          burstBeats = 0;

        const flash = numberParam(params, "flash", 30) / 1_000;
        const fadeOut = numberParam(params, "fadeOut", 0) / 1_000;
        const color = colorParam(params, "color", WHITE);
        const level = numberParam(params, "level", 1);
        for (const target of targets) {
          const alpha = flashAlpha(pulses.age(target), flash, fadeOut);
          if (alpha <= 0) continue;
          emit("color", target, color, alpha);
          emit("level", target, level, alpha);
        }
      },
    };
  },
});

/** Full for `flash` seconds from the pulse, then down over `fadeOut`. */
function flashAlpha(
  age: number | undefined,
  flash: number,
  fadeOut: number,
): number {
  if (age === undefined) return 0;
  // The frame a pulse starts in always shows, however short the flash.
  if (age <= 0 || age < flash) return 1;
  if (fadeOut <= 0) return 0;
  return Math.max(0, 1 - (age - flash) / fadeOut);
}
