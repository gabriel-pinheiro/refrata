import { createPulses, pulseParameters } from "./pulses.ts";
import { defineVisual, numberParam } from "./sdk.ts";

export const pump = defineVisual({
  id: "pump",
  name: "Pump",
  description: "Dips whatever is below it on the beat and lets it recover.",
  slots: [
    { key: "value", label: "Value", kind: "number", attribute: "dimmer" },
  ],
  parameters: {
    rate: { ...pulseParameters.rate, default: 2 },
    phaseSpread: pulseParameters.phaseSpread,
    depth: {
      kind: "number",
      label: "Depth",
      description: "How far a beat dips; 100 % is dark.",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0.8,
    },
    recover: {
      kind: "number",
      label: "Recover",
      description: "How long the way back up takes.",
      min: 0,
      max: 5_000,
      step: 1,
      unit: "ms",
      default: 350,
    },
  },
  cues: [
    { key: "hit", label: "Hit", description: "One dip now." },
    { key: "sync", label: "Sync", description: "Restart the beat now." },
  ],
  distributes: false,
  blendMode: "multiply",
  create({ random }) {
    const pulses = createPulses(random);
    let hits = 0;
    return {
      cue(key) {
        if (key === "sync") pulses.sync();
        if (key === "hit") hits += 1;
      },
      update({ dt, params, targets }, emit) {
        pulses.step(dt, numberParam(params, "rate", 2), targets, {
          spread: numberParam(params, "phaseSpread", 0),
          random: false,
        });
        if (hits > 0) pulses.hit(targets);
        hits = 0;
        const depth = numberParam(params, "depth", 0.8);
        const recover = numberParam(params, "recover", 350) / 1_000;
        for (const target of targets) {
          const age = pulses.age(target);
          const back =
            age === undefined
              ? 1
              : age <= 0
                ? 0
                : recover <= 0
                  ? 1
                  : Math.min(1, age / recover);
          // Fast out of the dip and slow into the top, as a compressor releases.
          emit("value", target, 1 - depth * (1 - back) ** 2);
        }
      },
    };
  },
});
