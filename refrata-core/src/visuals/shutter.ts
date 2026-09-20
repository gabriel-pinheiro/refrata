import { createPulses, pulseParameters } from "./pulses.ts";
import { defineVisual, numberParam } from "./sdk.ts";

export const shutter = defineVisual({
  id: "shutter",
  name: "Shutter",
  description: "Opens and closes whatever is below it, at a rate.",
  slots: [
    { key: "value", label: "Value", kind: "number", attribute: "dimmer" },
  ],
  parameters: {
    ...pulseParameters,
    open: {
      kind: "number",
      label: "Open",
      description: "How long it stays open on each beat.",
      min: 0,
      max: 1_000,
      step: 1,
      unit: "ms",
      default: 30,
    },
    depth: {
      kind: "number",
      label: "Depth",
      description: "How far it closes; 100 % is dark.",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 1,
    },
  },
  cues: [{ key: "sync", label: "Sync", description: "Restart the beat now." }],
  distributes: false,
  blendMode: "multiply",
  create({ random }) {
    const pulses = createPulses(random);
    return {
      cue(key) {
        if (key === "sync") pulses.sync();
      },
      update({ dt, params, targets }, emit) {
        const rate = numberParam(params, "rate", 8);
        pulses.step(dt, rate, targets, {
          spread: numberParam(params, "phaseSpread", 0),
          random: false,
        });
        const open = numberParam(params, "open", 30) / 1_000;
        const depth = numberParam(params, "depth", 1);
        for (const target of targets) {
          const age = pulses.age(target);
          // A stopped Shutter stays open; a running one shows each opening for a frame at least.
          const isOpen =
            rate <= 0 || (age !== undefined && (age <= 0 || age < open));
          emit("value", target, isOpen ? 1 : 1 - depth);
        }
      },
    };
  },
});
