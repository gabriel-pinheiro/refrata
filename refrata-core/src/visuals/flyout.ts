import {
  choiceParam,
  defineVisual,
  degreesParam,
  degreesSlot,
  numberParam,
  unitOfDegrees,
} from "./sdk.ts";

export const flyout = defineVisual({
  id: "flyout",
  name: "Flyout",
  description:
    "Beams fade in as they tilt out over the crowd, cut, and come back dark.",
  slots: [
    degreesSlot("tilt", "Tilt", "tilt"),
    { key: "level", label: "Level", kind: "number", attribute: "dimmer" },
  ],
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
    from: degreesParam("From", -135, 135, -30, "Where a fly starts, dark."),
    to: degreesParam("To", -135, 135, 60, "Where it cuts."),
    duration: {
      kind: "number",
      label: "Duration",
      description: "Seconds from From to To.",
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
      description: "Seconds dark at From before the next fly.",
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
    { key: "sync", label: "Sync", description: "Restart at From." },
  ],
  distributes: false,
  create() {
    /** Seconds since the first Target's fly began; undefined while On Go waits. */
    let clock: number | undefined;
    let go = false;
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
        const from = numberParam(params, "from", -30);
        const to = numberParam(params, "to", 60);
        const fadeIn = numberParam(params, "fadeIn", 0.3);
        for (const target of targets) {
          let t = clock - (spread * target.index * cycle) / target.count;
          if (loop) t -= Math.floor(t / cycle) * cycle;
          else if (t < 0 || t >= cycle) continue;
          const progress = Math.min(1, t / duration);
          const flying = t < duration;
          emit(
            "tilt",
            target,
            unitOfDegrees(
              "tilt",
              flying ? from + (to - from) * progress : from,
            ),
          );
          emit(
            "level",
            target,
            flying
              ? level * (fadeIn <= 0 ? 1 : Math.min(1, progress / fadeIn))
              : 0,
          );
        }
      },
    };
  },
});
