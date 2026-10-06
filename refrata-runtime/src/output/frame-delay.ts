type Frames = ReadonlyMap<string, Uint8Array>;

/**
 * The Output Delay's hold: each tick's frames go in stamped with the time
 * they were made and come out once they are as old as the delay, so the
 * Outputs send what was resolved that long ago. A frame counts as old enough
 * within the tolerance, half a tick, so a delay is a whole number of frames
 * and a tick a moment early does not hold a frame for one more. After a
 * stall, or when the delay is shortened, only the newest frame that is due
 * comes out; the ones it overtook are dropped rather than sent late.
 */
export class FrameDelay {
  readonly #held: { readonly at: number; readonly frames: Frames }[] = [];
  readonly #toleranceMs: number;

  constructor(toleranceMs: number) {
    this.#toleranceMs = toleranceMs;
  }

  /**
   * Takes the frames made at `now` and returns the ones to send, or
   * undefined while none held is old enough. With no delay that is the
   * frames just given.
   */
  step(frames: Frames, now: number, delayMs: number): Frames | undefined {
    this.#held.push({ at: now, frames });
    const dueBefore = now - delayMs + this.#toleranceMs;
    let due: Frames | undefined;
    for (
      let first = this.#held[0];
      first !== undefined && first.at <= dueBefore;
      first = this.#held[0]
    ) {
      due = first.frames;
      this.#held.shift();
    }
    return due;
  }

  /** Forgets what is held, so frames of a document no longer followed are never sent. */
  clear(): void {
    this.#held.length = 0;
  }
}
