import { choiceParam, defineVisual, numberParam, regionSlot } from "./sdk.ts";

export const flyout = defineVisual({
  id: "flyout",
  name: "Flyout",
  description:
    "Beams fade in as they tilt along the Region, cut, and come back dark, each fly at a random pan across it.",
  slots: [
    regionSlot("tilt", "Tilt", "tilt"),
    regionSlot("pan", "Pan", "pan"),
    { key: "level", label: "Level", kind: "number", attribute: "dimmer" },
  ],
  region: {
    width: "pan",
    height: "tilt",
    default: {
      form: "corners",
      from: { pan: -30, tilt: -30 },
      to: { pan: 30, tilt: 60 },
    },
  },
  parameters: {
    level: {
      kind: "number",
      label: "Level",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 1,
    },
    direction: {
      kind: "choice",
      label: "Direction",
      description:
        "Forward flies from the Region's From to its To; Backward the other way.",
      default: "forward",
      options: [
        { value: "forward", label: "Forward" },
        { value: "backward", label: "Backward" },
      ],
    },
    duration: {
      kind: "number",
      label: "Duration",
      description: "Seconds from one end of the Region to the other.",
      min: 0.2,
      max: 30,
      step: 0.1,
      unit: "s",
      default: 2,
    },
    fadeIn: {
      kind: "number",
      label: "Fade in",
      description: "The part of the fly the level takes to reach full.",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 0.3,
    },
    gap: {
      kind: "number",
      label: "Gap",
      description: "Seconds dark at the start before the next fly.",
      min: 0,
      max: 30,
      step: 0.1,
      unit: "s",
      default: 1,
    },
    run: {
      kind: "choice",
      label: "Run",
      description: "On Go, one fly per Go cue and nothing written in between.",
      default: "loop",
      options: [
        { value: "loop", label: "Loop" },
        { value: "go", label: "On Go" },
      ],
    },
    phaseSpread: {
      kind: "number",
      label: "Phase spread",
      description: "Flies of offset from the first Target to the last.",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0,
    },
  },
  cues: [
    { key: "go", label: "Go", description: "Fly now." },
    { key: "sync", label: "Sync", description: "Restart at the start." },
  ],
  distributes: false,
  create({ random }) {
    /** Seconds since the first Target's fly began; undefined while On Go waits. */
    let clock: number | undefined;
    let go = false;
    /** Per Target, the fly its pan was picked for and that pan, a fraction of the Region's width; the fly counts up from the first. */
    const pans = new Map<string, { fly: number; pan: number }>();
    return {
      cue(key) {
        if (key === "go") go = true;
        if (key === "sync") clock = 0;
      },
      update({ dt, params, targets }, emit) {
        const loop = choiceParam(params, "run", "loop") === "loop";
        const duration = numberParam(params, "duration", 2);
        const cycle = duration + numberParam(params, "gap", 1);
        const spread = numberParam(params, "phaseSpread", 0);
        if (go) clock = 0;
        else if (clock !== undefined) clock += dt;
        else if (loop) clock = 0;
        go = false;
        if (clock === undefined) return;
        if (!loop && clock >= cycle * (1 + spread)) {
          clock = undefined;
          return;
        }
        const level = numberParam(params, "level", 1);
        const backward =
          choiceParam(params, "direction", "forward") === "backward";
        const fadeIn = numberParam(params, "fadeIn", 0.3);
        const seen = new Set<string>();
        for (const target of targets) {
          let t = clock - (spread * target.index * cycle) / target.count;
          const nth = Math.floor(t / cycle);
          if (loop) t -= nth * cycle;
          else if (t < 0 || t >= cycle) continue;
          const progress = Math.min(1, t / duration);
          const flying = t < duration;
          // The gap belongs to the next fly: the pan moves at the cut, dark, and holds until the next cut.
          const fly = flying ? nth : nth + 1;
          seen.add(target.key);
          let picked = pans.get(target.key);
          if (picked?.fly !== fly) {
            picked = { fly, pan: random() };
            pans.set(target.key, picked);
          }
          const along = flying ? progress : 0;
          emit("pan", target, picked.pan);
          emit("tilt", target, backward ? 1 - along : along);
          emit(
            "level",
            target,
            flying
              ? level * (fadeIn <= 0 ? 1 : Math.min(1, progress / fadeIn))
              : 0,
          );
        }
        for (const key of pans.keys()) if (!seen.has(key)) pans.delete(key);
      },
    };
  },
});
