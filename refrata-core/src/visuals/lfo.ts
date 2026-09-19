import { choiceParam, defineVisual, numberParam, RATE_MAX_HZ } from "./sdk.ts";

const TAU = Math.PI * 2;

/** One cycle of each waveform over a phase of 0 to 1, starting at its lowest point. */
export function wave(waveform: string, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (waveform) {
    case "triangle":
      return p < 0.5 ? p * 2 : 2 - p * 2;
    case "square":
      return p < 0.5 ? 1 : 0;
    case "saw":
      return p;
    default:
      return 0.5 - 0.5 * Math.cos(TAU * p);
  }
}

export const lfo = defineVisual({
  id: "lfo",
  name: "LFO",
  description: "A wave on one number: breathing, pulsing, a slow swell.",
  slots: [
    { key: "value", label: "Value", kind: "number", attribute: "dimmer" },
  ],
  parameters: {
    waveform: {
      kind: "choice",
      label: "Waveform",
      default: "sine",
      options: [
        { value: "sine", label: "Sine" },
        { value: "triangle", label: "Triangle" },
        { value: "square", label: "Square" },
        { value: "saw", label: "Saw" },
      ],
    },
    rate: {
      kind: "number",
      label: "Rate",
      description: "Cycles per second.",
      min: 0,
      max: RATE_MAX_HZ,
      unit: "Hz",
      default: 0.5,
    },
    low: {
      kind: "number",
      label: "Low",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0,
    },
    high: {
      kind: "number",
      label: "High",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 1,
    },
    phaseSpread: {
      kind: "number",
      label: "Phase spread",
      description: "Cycles of offset from the first Target to the last.",
      min: 0,
      max: 4,
      default: 0,
    },
  },
  cues: [
    { key: "sync", label: "Sync", description: "Restart the wave at Low." },
  ],
  distributes: false,
  create() {
    let phase = 0;
    return {
      cue(key) {
        if (key === "sync") phase = 0;
      },
      update({ dt, params, targets }, emit) {
        phase += numberParam(params, "rate", 0.5) * dt;
        const low = numberParam(params, "low", 0);
        const high = numberParam(params, "high", 1);
        const spread = numberParam(params, "phaseSpread", 0);
        const waveform = choiceParam(params, "waveform", "sine");
        for (const target of targets) {
          const offset = (spread * target.index) / target.count;
          emit(
            "value",
            target,
            low + (high - low) * wave(waveform, phase - offset),
          );
        }
      },
    };
  },
});
