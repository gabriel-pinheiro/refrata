import { defineVisual, numberParam } from "./sdk.ts";

const unit = (value: number): number => Math.min(1, Math.max(0, value));

export const circle = defineVisual({
  id: "circle",
  name: "Circle",
  description: "A circle in pan and tilt, for movers.",
  slots: [
    { key: "x", label: "X", kind: "number", attribute: "pan" },
    { key: "y", label: "Y", kind: "number", attribute: "tilt" },
  ],
  parameters: {
    rate: {
      kind: "number",
      label: "Rate",
      description: "Turns per second.",
      min: 0,
      max: 1,
      step: 0.05,
      unit: "Hz",
      default: 0.25,
    },
    radius: {
      kind: "number",
      label: "Radius",
      min: 0,
      max: 0.5,
      default: 0.1,
    },
    centerX: {
      kind: "number",
      label: "Center X",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0.5,
    },
    centerY: {
      kind: "number",
      label: "Center Y",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0.5,
    },
    phaseSpread: {
      kind: "number",
      label: "Phase spread",
      description: "Turns of offset from the first Target to the last.",
      min: 0,
      max: 4,
      default: 0,
    },
  },
  cues: [{ key: "sync", label: "Sync", description: "Restart the turn." }],
  distributes: false,
  create() {
    let phase = 0;
    return {
      cue(key) {
        if (key === "sync") phase = 0;
      },
      update({ dt, params, targets }, emit) {
        phase += numberParam(params, "rate", 0.25) * dt;
        const radius = numberParam(params, "radius", 0.1);
        const centerX = numberParam(params, "centerX", 0.5);
        const centerY = numberParam(params, "centerY", 0.5);
        const spread = numberParam(params, "phaseSpread", 0);
        for (const target of targets) {
          const angle =
            Math.PI * 2 * (phase - (spread * target.index) / target.count);
          emit("x", target, unit(centerX + radius * Math.cos(angle)));
          emit("y", target, unit(centerY + radius * Math.sin(angle)));
        }
      },
    };
  },
});
