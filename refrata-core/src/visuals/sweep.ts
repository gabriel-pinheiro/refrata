import { choiceParam, defineVisual, degreesSlot, numberParam } from "./sdk.ts";

export const sweep = defineVisual({
  id: "sweep",
  name: "Sweep",
  description:
    "A beam crosses from one end of its range to the other and the rest follow behind, a searchlight chase.",
  slots: [degreesSlot("position", "Position", "pan")],
  parameters: {
    duration: {
      kind: "number",
      label: "Duration",
      description: "Seconds for one crossing, between the binding's ends.",
      min: 0.2,
      max: 60,
      step: 0.1,
      unit: "s",
      default: 3,
    },
    hold: {
      kind: "number",
      label: "Hold",
      description: "Seconds still at each end.",
      min: 0,
      max: 30,
      step: 0.1,
      unit: "s",
      default: 0.5,
    },
    run: {
      kind: "choice",
      label: "Run",
      default: "bounce",
      options: [
        { value: "bounce", label: "Bounce" },
        { value: "loop", label: "Loop" },
      ],
    },
    ease: {
      kind: "choice",
      label: "Ease",
      description: "Smooth slows into the ends; Linear keeps one speed.",
      default: "smooth",
      options: [
        { value: "smooth", label: "Smooth" },
        { value: "linear", label: "Linear" },
      ],
    },
    follow: {
      kind: "number",
      label: "Follow",
      description: "Seconds each Target trails the one before it.",
      min: 0,
      max: 10,
      step: 0.1,
      unit: "s",
      default: 0.3,
    },
  },
  cues: [
    { key: "sync", label: "Sync", description: "Restart from the first end." },
  ],
  distributes: true,
  create() {
    let clock = 0;
    return {
      cue(key) {
        if (key === "sync") clock = 0;
      },
      update({ dt, params, targets }, emit) {
        clock += dt;
        const duration = numberParam(params, "duration", 3);
        const leg = duration + numberParam(params, "hold", 0.5);
        const bounce = choiceParam(params, "run", "bounce") === "bounce";
        const smooth = choiceParam(params, "ease", "smooth") === "smooth";
        const follow = numberParam(params, "follow", 0.3);
        const period = bounce ? 2 * leg : leg;
        for (const target of targets) {
          const since = clock - follow * target.index;
          const t = since < 0 ? 0 : since - Math.floor(since / period) * period;
          const progress =
            t < leg
              ? Math.min(1, t / duration)
              : 1 - Math.min(1, (t - leg) / duration);
          emit(
            "position",
            target,
            smooth ? 0.5 - 0.5 * Math.cos(Math.PI * progress) : progress,
          );
        }
      },
    };
  },
});
