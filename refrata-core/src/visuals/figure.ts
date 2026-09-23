import { wave } from "./lfo.ts";
import {
  choiceParam,
  defineVisual,
  degreesParam,
  degreesSlot,
  numberParam,
  unitOfDegrees,
} from "./sdk.ts";

const TAU = Math.PI * 2;
/** How many times the spiral winds while its radius grows and shrinks once. */
const SPIRAL_TURNS = 3;

type Point = readonly [number, number];

/** The corners of each polygon form, walked at one speed and closed at the end. */
const CORNERS: Readonly<Record<string, readonly Point[]>> = {
  square: [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ],
  diamond: [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ],
  triangle: [
    [0, 1],
    [-1, -1],
    [1, -1],
  ],
};

function alongCorners(corners: readonly Point[], phase: number): Point {
  const at = phase * corners.length;
  const edge = Math.floor(at);
  const t = at - edge;
  const from = corners[edge % corners.length] ?? [0, 0];
  const to = corners[(edge + 1) % corners.length] ?? [0, 0];
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

/** Where a form is at `phase`, one cycle over 0 to 1, inside a box from −1 to 1. */
export function formPoint(form: string, phase: number): Point {
  const p = phase - Math.floor(phase);
  const angle = TAU * p;
  const corners = CORNERS[form];
  if (corners !== undefined) return alongCorners(corners, p);
  switch (form) {
    case "eight":
      return [Math.cos(angle), Math.sin(2 * angle)];
    case "line":
      return [Math.cos(angle), 0];
    case "spiral": {
      const radius = wave("triangle", p);
      return [
        radius * Math.cos(SPIRAL_TURNS * angle),
        radius * Math.sin(SPIRAL_TURNS * angle),
      ];
    }
    default:
      return [Math.cos(angle), Math.sin(angle)];
  }
}

export const figure = defineVisual({
  id: "figure",
  name: "Figure",
  description:
    "A figure drawn in pan and tilt: a circle, an eight, a line, a polygon.",
  slots: [degreesSlot("x", "X", "pan"), degreesSlot("y", "Y", "tilt")],
  parameters: {
    form: {
      kind: "choice",
      label: "Form",
      default: "circle",
      options: [
        { value: "circle", label: "Circle" },
        { value: "eight", label: "Eight" },
        { value: "line", label: "Line" },
        { value: "square", label: "Square" },
        { value: "diamond", label: "Diamond" },
        { value: "triangle", label: "Triangle" },
        { value: "spiral", label: "Spiral" },
      ],
    },
    rate: {
      kind: "number",
      label: "Rate",
      description: "Figures per second.",
      min: 0,
      max: 1,
      step: 0.05,
      unit: "Hz",
      default: 0.25,
    },
    width: degreesParam("Width", 0, 180, 30, "Across, before Rotation."),
    height: degreesParam("Height", 0, 180, 30, "Up and down, before Rotation."),
    centerX: degreesParam(
      "Center X",
      -270,
      270,
      0,
      "On blend Add, an offset from the position below.",
    ),
    centerY: degreesParam("Center Y", -135, 135, 0),
    rotation: degreesParam(
      "Rotation",
      -180,
      180,
      0,
      "Turns the figure; a Line at 90° runs in tilt.",
    ),
    direction: {
      kind: "choice",
      label: "Direction",
      default: "forward",
      options: [
        { value: "forward", label: "Forward" },
        { value: "backward", label: "Backward" },
      ],
    },
    phaseSpread: {
      kind: "number",
      label: "Phase spread",
      description: "Figures of offset from the first Target to the last.",
      min: 0,
      max: 4,
      default: 0,
    },
  },
  cues: [{ key: "sync", label: "Sync", description: "Restart the figure." }],
  distributes: false,
  blendMode: "add",
  create() {
    let phase = 0;
    return {
      cue(key) {
        if (key === "sync") phase = 0;
      },
      update({ dt, params, targets }, emit) {
        const backward =
          choiceParam(params, "direction", "forward") === "backward";
        phase += (backward ? -1 : 1) * numberParam(params, "rate", 0.25) * dt;
        const form = choiceParam(params, "form", "circle");
        const halfWidth = numberParam(params, "width", 30) / 2;
        const halfHeight = numberParam(params, "height", 30) / 2;
        const centerX = numberParam(params, "centerX", 0);
        const centerY = numberParam(params, "centerY", 0);
        const rotation = (numberParam(params, "rotation", 0) * TAU) / 360;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const spread = numberParam(params, "phaseSpread", 0);
        for (const target of targets) {
          const [px, py] = formPoint(
            form,
            phase - (spread * target.index) / target.count,
          );
          const x = px * halfWidth;
          const y = py * halfHeight;
          emit("x", target, unitOfDegrees("pan", centerX + x * cos - y * sin));
          emit("y", target, unitOfDegrees("tilt", centerY + x * sin + y * cos));
        }
      },
    };
  },
});
