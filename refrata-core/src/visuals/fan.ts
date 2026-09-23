import {
  choiceParam,
  defineVisual,
  degreesParam,
  degreesSlot,
  numberParam,
  unitOfDegrees,
} from "./sdk.ts";

export const fan = defineVisual({
  id: "fan",
  name: "Fan",
  description:
    "Spreads the beams apart by their place in the row, a still fan; nothing moves.",
  slots: [degreesSlot("x", "X", "pan"), degreesSlot("y", "Y", "tilt")],
  parameters: {
    form: {
      kind: "choice",
      label: "Form",
      description:
        "Line leans from the first Target to the last; Center leans the ends away from the middle.",
      default: "line",
      options: [
        { value: "line", label: "Line" },
        { value: "center", label: "Center" },
      ],
    },
    pan: degreesParam(
      "Pan",
      -180,
      180,
      60,
      "Degrees between the ends; negative crosses the beams.",
    ),
    tilt: degreesParam("Tilt", -180, 180, 0, "Degrees between the ends."),
  },
  cues: [],
  distributes: true,
  blendMode: "add",
  create() {
    return {
      update({ params, targets }, emit) {
        const center = choiceParam(params, "form", "line") === "center";
        const pan = numberParam(params, "pan", 60);
        const tilt = numberParam(params, "tilt", 0);
        for (const target of targets) {
          const place =
            target.count > 1 ? target.index / (target.count - 1) : 0.5;
          // The middle Target stays put in both forms.
          const lean = center ? Math.abs(place - 0.5) * 2 : place - 0.5;
          emit("x", target, unitOfDegrees("pan", lean * pan));
          emit("y", target, unitOfDegrees("tilt", lean * tilt));
        }
      },
    };
  },
});
