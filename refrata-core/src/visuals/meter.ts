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
  mixColor,
  numberParam,
  WHITE,
} from "./sdk.ts";

const GREEN = [0, 1, 0, 1] as const;
const RED = [1, 0, 0, 1] as const;

export const meter = defineVisual({
  id: "meter",
  name: "Meter",
  description: "A value fills the Targets from one end: a score, a level.",
  slots: fillSlots,
  parameters: {
    value: {
      kind: "number",
      label: "Value",
      description: "How much of the Targets is lit.",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0.5,
    },
    points: {
      kind: "number",
      label: "Points",
      description: "The Value snaps to this many equal parts; 0 is smooth.",
      min: 0,
      max: 64,
      step: 1,
      default: 0,
    },
    order: fillOrder,
    color: { kind: "color", label: "Color", default: [...GREEN] },
    colorEnd: { kind: "color", label: "Color end", default: [...RED] },
    gradient: {
      kind: "choice",
      label: "Gradient",
      description:
        "Color end at a full Value, or on the last Target of the fill.",
      default: "off",
      options: [
        { value: "off", label: "Off" },
        { value: "value", label: "By value" },
        { value: "targets", label: "By Target" },
      ],
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
    ...arriveParameters("fade", 100),
  },
  cues: [],
  distributes: true,
  create() {
    const fill = createFill();
    return {
      update({ dt, params, targets }, emit) {
        const steps = chaseSteps(
          choiceParam(params, "order", "forward"),
          targets.length,
        );
        const points = Math.round(numberParam(params, "points", 0));
        const raw = numberParam(params, "value", 0.5);
        const value = points > 0 ? Math.round(raw * points) / points : raw;
        const looks = fill.step(
          dt,
          steps.length,
          value * steps.length,
          choiceParam(params, "arrive", "fade"),
          numberParam(params, "arriveTime", 100) / 1_000,
        );
        const color = colorParam(params, "color", WHITE);
        const colorEnd = colorParam(params, "colorEnd", WHITE);
        const gradient = choiceParam(params, "gradient", "off");
        emitFill(
          emit,
          targets,
          steps,
          looks,
          (step) =>
            gradient === "value"
              ? mixColor(color, colorEnd, value)
              : gradient === "targets"
                ? mixColor(
                    color,
                    colorEnd,
                    step / Math.max(1, steps.length - 1),
                  )
                : color,
          numberParam(params, "level", 1),
        );
      },
    };
  },
});
