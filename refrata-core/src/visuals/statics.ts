import { colorParam, defineVisual, numberParam, WHITE } from "./sdk.ts";

export const staticNumber = defineVisual({
  id: "static-number",
  name: "Static Number",
  description: "One number on every Target.",
  slots: [
    { key: "value", label: "Value", kind: "number", attribute: "dimmer" },
  ],
  parameters: {
    value: {
      kind: "number",
      label: "Value",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 1,
    },
  },
  cues: [],
  distributes: false,
  create: () => ({
    update({ params, targets }, emit) {
      const value = numberParam(params, "value", 1);
      for (const target of targets) emit("value", target, value);
    },
  }),
});

export const staticColor = defineVisual({
  id: "static-color",
  name: "Static Color",
  description: "One colour on every Target.",
  slots: [{ key: "color", label: "Color", kind: "color", attribute: "color" }],
  parameters: {
    color: { kind: "color", label: "Color", default: WHITE },
  },
  cues: [],
  distributes: false,
  create: () => ({
    update({ params, targets }, emit) {
      const color = colorParam(params, "color", WHITE);
      for (const target of targets) emit("color", target, color);
    },
  }),
});
