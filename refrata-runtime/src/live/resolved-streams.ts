import {
  parseElementRef,
  settings,
  type ParameterValues,
  type ResolvedDocument,
} from "@refrata/core";
import type { ResolvedValues } from "@refrata/protocol";

/**
 * One session's Resolved Stream: the Fixtures it asked for, what it was
 * last told, and a timer that sends the difference at the stream rate. The
 * first message after a change of Fixtures is full; the rest carry only
 * Elements whose values changed.
 */
export interface StreamMessage {
  readonly full: boolean;
  readonly values: ResolvedValues;
}

export class ResolvedStream {
  #fixtureIds = new Set<string>();
  #sent = new Map<string, ParameterValues>();
  #pendingFull = false;
  #latest: ResolvedDocument = new Map();
  #timer: ReturnType<typeof setTimeout> | undefined;
  readonly #send: (message: StreamMessage) => void;
  readonly #rateHz: number;

  constructor(
    send: (message: StreamMessage) => void,
    rateHz = Math.min(settings.stream.rateHz, settings.output.rateHz),
  ) {
    this.#send = send;
    this.#rateHz = rateHz;
  }

  get active(): boolean {
    return this.#fixtureIds.size > 0;
  }

  /** Replaces the streamed set; the next message is full. */
  setFixtures(fixtureIds: readonly string[], latest: ResolvedDocument): void {
    this.#fixtureIds = new Set(fixtureIds);
    this.#sent.clear();
    this.#pendingFull = true;
    this.#latest = latest;
    this.flush();
  }

  /**
   * Another session took over the document: the same Fixtures, but what was
   * sent no longer stands, so the next message is full.
   */
  restart(): void {
    this.#sent.clear();
    this.#pendingFull = this.active;
  }

  /** The loop resolved again; what changed goes out on the next flush. */
  update(latest: ResolvedDocument): void {
    this.#latest = latest;
    if (!this.active || this.#timer !== undefined) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.flush();
    }, 1_000 / this.#rateHz);
  }

  /** Sends what the session has not seen: everything after a change of set, changes otherwise. */
  flush(): void {
    if (!this.active) return;
    const values: Record<string, ParameterValues> = {};
    let changed = false;
    for (const [ref, current] of this.#latest) {
      const fixtureId = parseElementRef(ref)?.fixtureId;
      if (fixtureId === undefined || !this.#fixtureIds.has(fixtureId)) continue;
      const previous = this.#sent.get(ref);
      if (previous !== undefined && sameValues(previous, current)) continue;
      values[ref] = current;
      this.#sent.set(ref, current);
      changed = true;
    }
    if (this.#pendingFull || changed) {
      this.#send({ full: this.#pendingFull, values });
      this.#pendingFull = false;
    }
  }

  close(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#fixtureIds.clear();
  }
}

function sameValues(a: ParameterValues, b: ParameterValues): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => {
    const left = a[key];
    const right = b[key];
    if (Array.isArray(left) && Array.isArray(right))
      return (
        left.length === right.length && left.every((v, i) => v === right[i])
      );
    return left === right;
  });
}
