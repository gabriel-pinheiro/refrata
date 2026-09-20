import { chaseSteps } from "./chase-order.ts";
import { createFill, emitFill, fillOrder, fillSlots } from "./fill.ts";
import { wave } from "./lfo.ts";
import {
  choiceParam,
  colorParam,
  defineVisual,
  mixColor,
  numberParam,
  WHITE,
} from "./sdk.ts";

/** Pulses per second of the last seconds and of the flashing end. */
const URGENT_HZ = 2;

export const timer = defineVisual({
  id: "timer",
  name: "Timer",
  description: "The Targets drain or fill over a duration, from the Start Cue.",
  slots: fillSlots,
  parameters: {
    duration: {
      kind: "number",
      label: "Duration",
      min: 1,
      max: 3_600,
      step: 1,
      unit: "s",
      default: 30,
    },
    mode: {
      kind: "choice",
      label: "Mode",
      description: "Drain starts full and empties; Fill starts empty.",
      default: "drain",
      options: [
        { value: "drain", label: "Drain" },
        { value: "fill", label: "Fill" },
      ],
    },
    order: fillOrder,
    color: { kind: "color", label: "Color", default: [0, 1, 0, 1] },
    colorEnd: {
      kind: "color",
      label: "Color end",
      description: "What the color turns into as the time runs out.",
      default: [1, 0, 0, 1],
    },
    level: {
      kind: "number",
      label: "Level",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 1,
    },
    urgent: {
      kind: "number",
      label: "Urgent",
      description: "The last seconds pulse; 0 for none.",
      min: 0,
      max: 60,
      step: 1,
      unit: "s",
      default: 5,
    },
    atEnd: {
      kind: "choice",
      label: "At the end",
      default: "flash",
      options: [
        { value: "hold", label: "Hold" },
        { value: "flash", label: "Flash" },
        { value: "dark", label: "Dark" },
      ],
    },
  },
  cues: [
    { key: "start", label: "Start", description: "Run from the beginning." },
    { key: "pause", label: "Pause" },
    { key: "resume", label: "Resume" },
    { key: "reset", label: "Reset", description: "Back to the beginning." },
  ],
  distributes: true,
  create() {
    const fill = createFill();
    let elapsed = 0;
    let running = false;
    /** Seconds since the time ran out, which the flashing end counts on. */
    let over = 0;
    let pending: string[] = [];
    return {
      cue(key) {
        pending.push(key);
      },
      update({ dt, params, targets }, emit) {
        const duration = numberParam(params, "duration", 30);
        for (const key of pending) {
          if (key === "start" || key === "reset") {
            elapsed = 0;
            over = 0;
          }
          if (key === "start" || key === "resume") running = true;
          if (key === "pause" || key === "reset") running = false;
        }
        pending = [];
        if (running) elapsed += dt;
        const ended = elapsed >= duration;
        if (ended) {
          elapsed = duration;
          if (running) over += dt;
        }
        const spent = elapsed / duration;
        const steps = chaseSteps(
          choiceParam(params, "order", "forward"),
          targets.length,
        );
        const color = mixColor(
          colorParam(params, "color", WHITE),
          colorParam(params, "colorEnd", WHITE),
          spent,
        );
        const level = numberParam(params, "level", 1);
        const atEnd = choiceParam(params, "atEnd", "flash");
        if (ended && atEnd !== "hold") {
          const looks = fill.step(dt, steps.length, 0, "cut", 0);
          if (atEnd === "dark") return;
          const on = wave("square", over * URGENT_HZ);
          for (const look of looks) look.alpha = on;
          emitFill(emit, targets, steps, looks, () => color, level);
          return;
        }
        const draining = choiceParam(params, "mode", "drain") === "drain";
        const looks = fill.step(
          dt,
          steps.length,
          (draining ? 1 - spent : spent) * steps.length,
          "cut",
          0,
        );
        const left = duration - elapsed;
        const urgent = running && left <= numberParam(params, "urgent", 5);
        const dim = urgent ? 0.35 + 0.65 * wave("sine", left * URGENT_HZ) : 1;
        emitFill(emit, targets, steps, looks, () => color, level, dim);
      },
    };
  },
});
