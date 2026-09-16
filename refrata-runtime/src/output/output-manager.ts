import { settings, type Output, type Table } from "@refrata/core";
import type { OutputStatus } from "@refrata/protocol";

import type { OutputDrivers } from "./drivers.ts";
import { DeviceMissingError, type OutputLink } from "./output-driver.ts";

interface OpenOutput {
  readonly output: Output;
  link: OutputLink | undefined;
  status: OutputStatus;
  /** Frames delivered since the last fps sample. */
  sent: number;
  /** A send in flight; the next frame waits so writes never interleave. */
  busy: boolean;
  /** When the last open attempt was made, so a missing device is retried but not hammered. */
  lastAttemptAt: number;
}

/** The send, or a rejection once it has taken longer than `ms`. */
function withTimeout(send: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `The device took longer than ${String(ms)} ms to take a frame.`,
        ),
      );
    }, ms);
  });
  return Promise.race([send, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

export interface OutputManagerOptions {
  readonly drivers: OutputDrivers;
  readonly log: (message: string) => void;
  /** How long to wait before looking for a missing device again. */
  readonly retryMs?: number;
  /** How long a frame's send may take before it counts as failed. */
  readonly sendTimeoutMs?: number;
  readonly now?: () => number;
}

/**
 * Keeps one open link per Output in the document through its kind's
 * driver, sends each Universe's frame through the Outputs that carry it,
 * and reports every Output's status as live state. A device that is
 * missing, vanishes, fails or hangs is retried without stopping the loop.
 * Nothing here knows what carries the frames.
 */
export class OutputManager {
  readonly #open = new Map<string, OpenOutput>();
  readonly #options: OutputManagerOptions;
  readonly #listeners = new Set<() => void>();
  #lastSampleAt: number;

  constructor(options: OutputManagerOptions) {
    this.#options = options;
    this.#lastSampleAt = this.#now();
  }

  #now(): number {
    return this.#options.now?.() ?? Date.now();
  }

  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  statuses(): Record<string, OutputStatus> {
    return Object.fromEntries(
      [...this.#open.entries()].map(([id, entry]) => [id, entry.status]),
    );
  }

  /** Aligns open links with the document's Outputs: closes what is gone or changed, opens what is new. */
  async sync(outputs: Table<Output>): Promise<void> {
    for (const [id, entry] of this.#open) {
      const current = outputs[id];
      if (
        current?.kind !== entry.output.kind ||
        current.device !== entry.output.device ||
        current.universeId !== entry.output.universeId
      ) {
        await entry.link?.close();
        this.#open.delete(id);
      }
    }
    for (const output of Object.values(outputs)) {
      if (this.#open.has(output.id)) continue;
      this.#open.set(output.id, {
        output,
        link: undefined,
        status: { state: "device-missing", path: null, fps: 0 },
        sent: 0,
        busy: false,
        lastAttemptAt: Number.NEGATIVE_INFINITY,
      });
    }
    await Promise.all(
      [...this.#open.values()].map((entry) => this.#ensureOpen(entry)),
    );
    this.#emit();
  }

  async #ensureOpen(entry: OpenOutput): Promise<void> {
    if (entry.link !== undefined) return;
    const retryMs = this.#options.retryMs ?? settings.output.deviceRetryMs;
    if (this.#now() - entry.lastAttemptAt < retryMs) return;
    entry.lastAttemptAt = this.#now();
    try {
      const link = await this.#options.drivers[entry.output.kind].open(
        entry.output.device,
      );
      if (this.#open.get(entry.output.id) !== entry) {
        await link.close();
        return;
      }
      link.onClose((error) => {
        this.#lose(entry, link, {
          state: "device-missing",
          path: null,
          fps: 0,
          message: error?.message ?? "The device went away.",
        });
      });
      entry.link = link;
      this.#setStatus(entry, {
        state: "delivering",
        path: link.location,
        fps: 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.#setStatus(entry, {
        state: error instanceof DeviceMissingError ? "device-missing" : "error",
        path: null,
        fps: 0,
        message,
      });
    }
  }

  /** Sends each Universe's frame through its Outputs; a slow device skips frames rather than queueing them. */
  send(frames: ReadonlyMap<string, Uint8Array>): void {
    for (const entry of this.#open.values()) {
      const frame = frames.get(entry.output.universeId);
      const link = entry.link;
      if (frame === undefined || link === undefined || entry.busy) {
        if (link === undefined)
          void this.#ensureOpen(entry).then(() => this.#emit());
        continue;
      }
      entry.busy = true;
      withTimeout(
        link.send(frame),
        this.#options.sendTimeoutMs ?? settings.output.sendTimeoutMs,
      )
        .then(() => {
          entry.sent += 1;
        })
        .catch((error: unknown) => {
          this.#lose(entry, link, {
            state: "error",
            path: link.location,
            fps: 0,
            message: error instanceof Error ? error.message : String(error),
          });
          this.#emit();
        })
        .finally(() => {
          entry.busy = false;
        });
    }
    this.#sample();
  }

  /**
   * Forgets a link that closed or failed a send, so the next frame looks for
   * the widget again. A failed send must count: an unplugged Open DMX widget
   * fails its break without the port ever reporting a close, and a link kept
   * open would hold the dead device node forever. A link already replaced or
   * forgotten is left alone, so its late close cannot clobber the status.
   */
  #lose(entry: OpenOutput, link: OutputLink, status: OutputStatus): void {
    if (entry.link !== link) return;
    entry.link = undefined;
    void link.close();
    this.#setStatus(entry, status);
  }

  /** Once a second, turns sent counts into fps on every status. */
  #sample(): void {
    const now = this.#now();
    const elapsed = now - this.#lastSampleAt;
    if (elapsed < 1_000) return;
    this.#lastSampleAt = now;
    let changed = false;
    for (const entry of this.#open.values()) {
      const fps = Math.round((entry.sent * 1_000) / elapsed);
      entry.sent = 0;
      if (fps !== entry.status.fps) {
        entry.status = { ...entry.status, fps };
        changed = true;
      }
    }
    if (changed) this.#emit();
  }

  #setStatus(entry: OpenOutput, status: OutputStatus): void {
    const before = entry.status;
    entry.status = status;
    if (before.state !== status.state || before.message !== status.message)
      this.#options.log(
        `Output ${entry.output.id}: ${status.state}${status.message === undefined ? "" : ` (${status.message})`}`,
      );
  }

  async close(): Promise<void> {
    for (const entry of this.#open.values()) await entry.link?.close();
    this.#open.clear();
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }
}
