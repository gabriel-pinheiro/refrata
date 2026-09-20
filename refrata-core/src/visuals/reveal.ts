import {
  choiceParam,
  colorParam,
  defineVisual,
  mixColor,
  numberParam,
  WHITE,
  type VisualTarget,
} from "./sdk.ts";

const STYLES = [
  { value: "cut", label: "Cut" },
  { value: "fade", label: "Fade" },
  { value: "scatter", label: "Scatter" },
  { value: "flicker", label: "Flicker on" },
  { value: "flash", label: "Flash white" },
  { value: "wipe", label: "Wipe" },
  { value: "center-out", label: "Center out" },
] as const;

/** The share of a wipe's time its soft edge takes to cross one Target. */
const EDGE = 0.2;

export const reveal = defineVisual({
  id: "reveal",
  name: "Reveal",
  description:
    "Nothing until the Reveal Cue, then every Target takes the color.",
  slots: [
    { key: "color", label: "Color", kind: "color", attribute: "color" },
    { key: "level", label: "Level", kind: "number", attribute: "dimmer" },
  ],
  parameters: {
    color: { kind: "color", label: "Color", default: [0, 1, 0, 1] },
    level: {
      kind: "number",
      label: "Level",
      min: 0,
      max: 1,
      step: 0.01,
      percent: true,
      default: 1,
    },
    style: {
      kind: "choice",
      label: "Style",
      description:
        "How the color arrives; Random picks another at each Reveal.",
      default: "scatter",
      options: [...STYLES, { value: "random", label: "Random" }],
    },
    time: {
      kind: "number",
      label: "Time",
      min: 0,
      max: 10_000,
      step: 1,
      unit: "ms",
      default: 1_200,
    },
  },
  cues: [
    { key: "reveal", label: "Reveal", description: "Bring the color on." },
    { key: "hide", label: "Hide", description: "Let go of every Target." },
  ],
  distributes: false,
  create({ random }) {
    /** 0 hidden, 1 revealed; it travels between them over Time. */
    let progress = 0;
    let shown = false;
    /** The style of the reveal under way, kept so a Random one does not change halfway. */
    let style: string | undefined;
    let pending: string[] = [];
    /** A moment of its own for each Target, rolled again at every Reveal. */
    const moments = new Map<string, number>();

    const momentOf = (target: VisualTarget): number => {
      let moment = moments.get(target.key);
      if (moment === undefined) {
        moment = random();
        moments.set(target.key, moment);
      }
      return moment;
    };

    /** How lit a Target is at `progress`, and how white. */
    const look = (target: VisualTarget, how: string): [number, number] => {
      if (progress >= 1) return [1, 0];
      if (progress <= 0) return [0, 0];
      const along = target.index / target.count;
      const soft = (start: number) =>
        Math.min(1, Math.max(0, (progress - start * (1 - EDGE)) / EDGE));
      switch (how) {
        case "scatter":
          return [progress > momentOf(target) * 0.9 ? 1 : 0, 0];
        case "flicker":
          return [random() < progress ** 2 ? 1 : 0, 0];
        case "flash":
          return [1, 1 - progress];
        case "wipe":
          return [soft(along), 0];
        case "center-out":
          return [
            soft(Math.abs((target.index + 0.5) / target.count - 0.5) * 2),
            0,
          ];
        default:
          return [progress, 0];
      }
    };

    return {
      cue(key) {
        pending.push(key);
      },
      update({ dt, params, targets }, emit) {
        const chosen = choiceParam(params, "style", "scatter");
        for (const key of pending) {
          if (key === "reveal") {
            shown = true;
            progress = 0;
            moments.clear();
            style =
              chosen === "random"
                ? (STYLES[Math.floor(random() * STYLES.length)]?.value ??
                  "fade")
                : chosen;
          }
          if (key === "hide") shown = false;
        }
        pending = [];
        const seconds = numberParam(params, "time", 1_200) / 1_000;
        const how = style ?? chosen;
        const travel = seconds <= 0 || how === "cut" ? 1 : dt / seconds;
        progress = shown
          ? Math.min(1, progress + travel)
          : Math.max(0, progress - travel);
        if (progress <= 0) return;

        const color = colorParam(params, "color", WHITE);
        const level = numberParam(params, "level", 1);
        for (const target of targets) {
          // Going away, the two styles that only make sense forwards fade instead.
          const [alpha, white] = look(
            target,
            !shown && (how === "flicker" || how === "flash") ? "fade" : how,
          );
          if (alpha <= 0) continue;
          emit("color", target, mixColor(color, WHITE, white), alpha);
          emit("level", target, level, alpha);
        }
      },
    };
  },
});
