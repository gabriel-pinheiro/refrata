import { chaseSteps } from "./chase-order.ts";
import {
  arriveParameters,
  createFill,
  emitFill,
  fillOrder,
  fillSlots,
} from "./fill.ts";
import {
  choiceParam,
  colorParam,
  defineVisual,
  numberParam,
  WHITE,
} from "./sdk.ts";

export const counter = defineVisual({
  id: "counter",
  name: "Counter",
  description: "Each Add Cue lights one more point and keeps the others lit.",
  slots: fillSlots,
  parameters: {
    points: {
      kind: "number",
      label: "Points",
      description: "Points that fill every Target; 0 is one per Target.",
      min: 0,
      max: 64,
      step: 1,
      default: 0,
    },
    order: fillOrder,
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
    ...arriveParameters("drop", 400),
  },
  cues: [
    { key: "add", label: "Add", description: "One more point." },
    { key: "remove", label: "Remove", description: "One point less." },
    { key: "reset", label: "Reset", description: "Back to none." },
  ],
  distributes: true,
  create() {
    const fill = createFill();
    let count = 0;
    let pending: string[] = [];
    return {
      cue(key) {
        pending.push(key);
      },
      update({ dt, params, targets }, emit) {
        const steps = chaseSteps(
          choiceParam(params, "order", "forward"),
          targets.length,
        );
        const points =
          Math.round(numberParam(params, "points", 0)) || steps.length;
        // With no Targets for a moment (a Spread toggled) the count is kept as it is.
        const top = points > 0 ? points : Number.POSITIVE_INFINITY;
        for (const key of pending) {
          if (key === "add") count += 1;
          if (key === "remove") count -= 1;
          if (key === "reset") count = 0;
          count = Math.min(top, Math.max(0, count));
        }
        pending = [];
        count = Math.min(top, count);
        const looks = fill.step(
          dt,
          steps.length,
          points === 0 ? 0 : (count / points) * steps.length,
          choiceParam(params, "arrive", "drop"),
          numberParam(params, "arriveTime", 400) / 1_000,
        );
        const color = colorParam(params, "color", WHITE);
        emitFill(
          emit,
          targets,
          steps,
          looks,
          () => color,
          numberParam(params, "level", 1),
        );
      },
    };
  },
});
