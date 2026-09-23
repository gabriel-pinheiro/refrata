import { settings } from "@refrata/core";
import type { FrameBytes } from "@refrata/protocol";

/**
 * One session's frame stream: the Universes it asked DMX Frames for, the
 * bytes it was last told, and a timer that sends the difference at the
 * stream rate. The first message for a Universe is all 512 bytes; the rest
 * carry only the addresses whose byte changed, and a still frame sends
 * nothing.
 */
export interface FrameMessage {
  readonly universeId: string;
  readonly full: boolean;
  readonly bytes: FrameBytes;
}

export class FrameStream {
  #universeIds = new Set<string>();
  #sent = new Map<string, Uint8Array>();
  #latest: ReadonlyMap<string, Uint8Array> = new Map();
  #timer: ReturnType<typeof setTimeout> | undefined;
  readonly #send: (message: FrameMessage) => void;
  readonly #rateHz: number;

  constructor(
    send: (message: FrameMessage) => void,
    rateHz = Math.min(settings.stream.rateHz, settings.output.rateHz),
  ) {
    this.#send = send;
    this.#rateHz = rateHz;
  }

  get active(): boolean {
    return this.#universeIds.size > 0;
  }

  /** Replaces the streamed set; each Universe's next message is full. */
  setUniverses(
    universeIds: readonly string[],
    latest: ReadonlyMap<string, Uint8Array>,
  ): void {
    this.#universeIds = new Set(universeIds);
    this.#sent.clear();
    this.#latest = latest;
    this.flush();
  }

  /** Another session took over the document: what was sent no longer stands. */
  restart(): void {
    this.#sent.clear();
  }

  /** The loop encoded again; what changed goes out on the next flush. */
  update(latest: ReadonlyMap<string, Uint8Array>): void {
    this.#latest = latest;
    if (!this.active || this.#timer !== undefined) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.flush();
    }, 1_000 / this.#rateHz);
  }

  /** Sends what the session has not seen: every byte of a Universe it was not told about yet, changes otherwise. */
  flush(): void {
    for (const universeId of this.#universeIds) {
      const frame = this.#latest.get(universeId);
      // A Universe the loop has no frame for is gone; the client hears through the document.
      if (frame === undefined) continue;
      const previous = this.#sent.get(universeId);
      const bytes: Record<string, number> = {};
      let changed = false;
      for (let slot = 0; slot < frame.length; slot += 1) {
        const byte = frame[slot] ?? 0;
        if (previous?.[slot] === byte) continue;
        bytes[String(slot + 1)] = byte;
        changed = true;
      }
      if (previous !== undefined && !changed) continue;
      this.#sent.set(universeId, frame);
      this.#send({ universeId, full: previous === undefined, bytes });
    }
  }

  close(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#universeIds.clear();
    this.#sent.clear();
  }
}
