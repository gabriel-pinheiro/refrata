import { CHASE_ORDERS, heads } from "./chase-order.ts";
import { envelopeParameters, envelopeSlots } from "./envelope-parameters.ts";
import {
  choiceParam,
  colorParam,
  defineVisual,
  numberParam,
  RATE_MAX_HZ,
  WHITE,
  type VisualTarget,
} from "./sdk.ts";

export const chase = defineVisual({
  id: "chase",
  name: "Chase",
  description: "One Target lit after another, in the Set's order.",
  slots: envelopeSlots("level"),
  parameters: {
    ...envelopeParameters,
    rate: {
      kind: "number",
      label: "Rate",
      description: "Steps per second; 0 leaves it to the Step Cue.",
      min: 0,
      max: RATE_MAX_HZ,
      unit: "Hz",
      default: 2,
    },
    order: {
      kind: "choice",
      label: "Order",
      default: "forward",
      options: CHASE_ORDERS,
    },
    tail: {
      kind: "number",
      label: "Tail",
      description: "Targets glowing behind the head.",
      min: 0,
      max: 32,
      step: 1,
      default: 0,
    },
    fade: {
      kind: "number",
      label: "Fade",
      description: "How long a level takes to reach its new value at a step.",
      min: 0,
      max: 5_000,
      step: 1,
      unit: "ms",
      default: 0,
    },
  },
  cues: [
    { key: "step", label: "Step", description: "Advance one step now." },
    {
      key: "restart",
      label: "Restart",
      description: "Back to the first step.",
    },
  ],
  distributes: true,
  create({ random }) {
    /** Steps taken since the start; the first step is lit from the first frame. */
    let position = 0;
    /** The Target keys lit at each of the latest steps, newest first. */
    let history: string[][] = [];
    let lastHeads: readonly number[] = [];
    let elapsed = 0;
    let pendingSteps = 0;
    let restart = true;
    const levels = new Map<string, number>();

    const light = (
      targets: readonly VisualTarget[],
      order: string,
      tail: number,
    ): void => {
      lastHeads = heads(order, targets.length, position, lastHeads, random);
      history.unshift(lastHeads.map((index) => targets[index]?.key ?? ""));
      history = history.slice(0, tail + 1);
    };

    return {
      cue(key) {
        if (key === "step") pendingSteps += 1;
        if (key === "restart") restart = true;
      },
      update({ dt, params, targets }, emit) {
        const order = choiceParam(params, "order", "forward");
        const tail = Math.round(numberParam(params, "tail", 0));
        const rate = numberParam(params, "rate", 2);
        if (restart) {
          restart = false;
          position = 0;
          history = [];
          lastHeads = [];
          elapsed = 0;
          pendingSteps = 0;
          light(targets, order, tail);
        }
        let steps = pendingSteps;
        if (pendingSteps > 0) elapsed = 0;
        pendingSteps = 0;
        if (rate > 0) {
          elapsed += dt;
          const due = Math.floor(elapsed * rate);
          if (due > 0) {
            steps += Math.min(due, targets.length + 1);
            elapsed -= due / rate;
          }
        } else elapsed = 0;
        // Targets changed under the head (a Spread toggled): light the same step among the new ones.
        const head = history[0] ?? [];
        if (
          targets.length > 0 &&
          !head.some((key) => targets.some((target) => target.key === key))
        ) {
          history.shift();
          light(targets, order, tail);
        }
        for (let taken = 0; taken < steps; taken += 1) {
          position += 1;
          light(targets, order, tail);
        }

        const wanted = new Map<string, number>();
        history.forEach((keys, age) => {
          const level = 1 - age / (tail + 1);
          for (const key of keys)
            wanted.set(key, Math.max(wanted.get(key) ?? 0, level));
        });
        const fade = numberParam(params, "fade", 0) / 1_000;
        const travel = fade <= 0 ? 1 : dt / fade;
        for (const key of new Set([...levels.keys(), ...wanted.keys()])) {
          const current = levels.get(key) ?? 0;
          const goal = wanted.get(key) ?? 0;
          const moved =
            current < goal
              ? Math.min(goal, current + travel)
              : Math.max(goal, current - travel);
          if (moved <= 0) levels.delete(key);
          else levels.set(key, moved);
        }

        const color = colorParam(params, "color", WHITE);
        const level = numberParam(params, "level", 1);
        for (const target of targets) {
          const alpha = levels.get(target.key);
          if (alpha === undefined) continue;
          emit("level", target, level, alpha);
          emit("color", target, color, alpha);
        }
      },
    };
  },
});
