import type { ParameterSchema } from "../parameters.ts";
import { RATE_MAX_HZ, type VisualTarget } from "./sdk.ts";

/** How a beat Visual spreads its Targets over one cycle. */
export interface PulseSpread {
  /** Cycles of offset from the first Target to the last. */
  readonly spread: number;
  /** Every Target on an offset of its own instead, kept while the Target stays. */
  readonly random: boolean;
}

/**
 * The clock the beat Visuals (Strobe, Shutter, Pump) share: one phase
 * advancing at a rate in hertz, a pulse for each Target every time its own
 * offset phase passes a whole beat, and the seconds since each Target's
 * latest pulse. A pulse starts at age 0 in the frame it happens, so the
 * shortest one still shows for a frame.
 */
export function createPulses(random: () => number) {
  let phase = 0;
  /** True until the first step after a start or a sync: beat 0 then pulses at once. */
  let fresh = true;
  const ages = new Map<string, number>();
  const beats = new Map<string, number>();
  const offsets = new Map<string, number>();

  const offsetOf = (target: VisualTarget, how: PulseSpread): number => {
    if (!how.random) return (how.spread * target.index) / target.count;
    let offset = offsets.get(target.key);
    if (offset === undefined) {
      offset = random();
      offsets.set(target.key, offset);
    }
    return offset;
  };

  return {
    /** Beats since the start or the latest sync. */
    get phase(): number {
      return phase;
    },
    /** Back to beat 0, which pulses in the next step. */
    sync(): void {
      phase = 0;
      fresh = true;
      beats.clear();
    },
    /** Every Target pulses now, whatever the clock says. */
    hit(targets: readonly VisualTarget[]): void {
      for (const target of targets) ages.set(target.key, 0);
    },
    /**
     * Ages every pulse by `dt`, advances the clock by `rate` and starts
     * the pulses that came due. `allowed` refuses beats, which is how a
     * burst ends.
     */
    step(
      dt: number,
      rate: number,
      targets: readonly VisualTarget[],
      how: PulseSpread,
      allowed: (beat: number) => boolean = () => true,
    ): void {
      const present = new Set(targets.map((target) => target.key));
      for (const key of ages.keys())
        if (present.has(key)) ages.set(key, (ages.get(key) ?? 0) + dt);
        else ages.delete(key);
      for (const key of beats.keys()) if (!present.has(key)) beats.delete(key);
      for (const key of offsets.keys())
        if (!present.has(key)) offsets.delete(key);
      // A stopped clock pulses nothing, not even beat 0.
      if (rate <= 0) return;
      if (!fresh) phase += rate * dt;
      for (const target of targets) {
        const beat = Math.floor(phase - offsetOf(target, how) + 1e-9);
        const last = beats.get(target.key) ?? (fresh ? -1 : beat);
        beats.set(target.key, Math.max(beat, last));
        if (beat > last && beat >= 0 && allowed(beat)) ages.set(target.key, 0);
      }
      fresh = false;
    },
    /** Seconds since the Target's latest pulse; undefined before its first. */
    age(target: VisualTarget): number | undefined {
      return ages.get(target.key);
    },
  };
}

export const pulseParameters = {
  rate: {
    kind: "number",
    label: "Rate",
    description: "Beats per second; 0 leaves it to the Cues.",
    min: 0,
    max: RATE_MAX_HZ,
    unit: "Hz",
    default: 8,
  },
  phaseSpread: {
    kind: "number",
    label: "Phase spread",
    description: "Cycles of offset from the first Target to the last.",
    min: 0,
    max: 4,
    default: 0,
  },
} as const satisfies ParameterSchema;
