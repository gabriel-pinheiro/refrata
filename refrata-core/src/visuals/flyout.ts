import { choiceParam, defineVisual, numberParam, regionSlot } from "./sdk.ts";

/** One mover: the pan it waits or flies at, and where it is between flying and resting. */
interface Mover {
  /** A fraction of the Region's width, picked when the last fly ended. */
  pan: number;
  /** Seconds into its fly; undefined while it rests at the start. */
  flying: number | undefined;
  /** Seconds since it came back to the start. */
  rested: number;
}

/** One Go on its way down the Targets, each reached Follow seconds after the one before. */
interface Go {
  age: number;
  /** The index of the first Target it has not reached. */
  next: number;
}

/** What two clocks that count the same seconds may differ by. */
const EPSILON = 1e-9;

export const flyout = defineVisual({
  id: "flyout",
  name: "Flyout",
  description:
    "Beams fade in as they tilt along the Region, cut, and come back dark, each fly at a random pan across it; in a loop or on a Cue.",
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
    direction: {
      kind: "choice",
      label: "Direction",
      description:
        "Tilt rising flies from the Region's From to its To; Tilt falling the other way.",
      default: "rising",
      options: [
        { value: "rising", label: "Tilt rising" },
        { value: "falling", label: "Tilt falling" },
      ],
    },
    duration: {
      kind: "number",
      label: "Duration",
      description: "Seconds a fly takes, from lighting up to the cut.",
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
    settle: {
      kind: "number",
      label: "Settle",
      description:
        "Seconds a mover needs to get back to the start, dark; it flies again only after them.",
      min: 0,
      max: 30,
      step: 0.1,
      unit: "s",
      default: 0.5,
    },
    gap: {
      kind: "number",
      label: "Gap",
      description: "On Loop, seconds waited after Settle before the next fly.",
      min: 0,
      max: 30,
      step: 0.1,
      unit: "s",
      default: 1,
    },
    run: {
      kind: "choice",
      label: "Run",
      description:
        "On Go waits dark at the start and flies once per Go Cue; Loop flies by itself too.",
      default: "loop",
      options: [
        { value: "loop", label: "Loop" },
        { value: "go", label: "On Go" },
      ],
    },
    follow: {
      kind: "number",
      label: "Follow",
      description: "Seconds each Target flies after the one before it.",
      min: 0,
      max: 10,
      step: 0.1,
      unit: "s",
      default: 0,
    },
  },
  cues: [
    {
      key: "go",
      label: "Go",
      description: "Fly now; a mover still flying or settling sits it out.",
    },
  ],
  distributes: false,
  create({ random }) {
    const movers = new Map<string, Mover>();
    let gos: Go[] = [];
    let cued = false;
    /** Seconds since the last Go, the Loop's own or a Cue's; undefined before the first frame. */
    let sinceGo: number | undefined;
    return {
      cue(key) {
        if (key === "go") cued = true;
      },
      update({ dt, params, targets }, emit) {
        const duration = numberParam(params, "duration", 2);
        const settle = numberParam(params, "settle", 0.5);
        const follow = numberParam(params, "follow", 0);
        const cycle = duration + settle + numberParam(params, "gap", 1);
        for (const go of gos) go.age += dt;
        // The first fly of a Loop comes once the movers have settled.
        sinceGo = sinceGo === undefined ? cycle - settle : sinceGo + dt;
        if (cued) {
          gos.push({ age: 0, next: 0 });
          sinceGo = 0;
        } else if (
          choiceParam(params, "run", "loop") === "loop" &&
          sinceGo >= cycle - EPSILON
        ) {
          sinceGo = Math.max(0, Math.min(sinceGo - cycle, cycle));
          gos.push({ age: sinceGo, next: 0 });
        }
        cued = false;

        const falling =
          choiceParam(params, "direction", "rising") === "falling";
        const fadeIn = numberParam(params, "fadeIn", 0.3);
        const seen = new Set<string>();
        for (const target of targets) {
          seen.add(target.key);
          let mover = movers.get(target.key);
          if (mover === undefined) {
            mover = { pan: random(), flying: undefined, rested: 0 };
            movers.set(target.key, mover);
          } else if (mover.flying === undefined) mover.rested += dt;
          else mover.flying += dt;
          if (mover.flying !== undefined && mover.flying >= duration) {
            // The pan moves at the cut, dark, and holds until the next cut.
            mover.rested = mover.flying - duration;
            mover.flying = undefined;
            mover.pan = random();
          }
          const delay = follow * target.index;
          for (const go of gos) {
            if (target.index < go.next || go.age + EPSILON < delay) continue;
            go.next = target.index + 1;
            if (mover.flying !== undefined) continue;
            if (mover.rested + EPSILON < settle) continue;
            mover.flying = Math.max(0, go.age - delay);
          }
          const along =
            mover.flying === undefined ? 0 : mover.flying / duration;
          emit("pan", target, mover.pan);
          emit("tilt", target, falling ? 1 - along : along);
          emit(
            "level",
            target,
            mover.flying === undefined
              ? 0
              : fadeIn <= 0
                ? 1
                : Math.min(1, along / fadeIn),
          );
        }
        gos = gos.filter((go) => go.next < targets.length);
        for (const key of movers.keys()) if (!seen.has(key)) movers.delete(key);
      },
    };
  },
});
