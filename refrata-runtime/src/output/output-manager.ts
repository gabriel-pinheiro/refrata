import type { Output, Table } from "@refrata/core";
import type { OutputStatus } from "@refrata/protocol";

import { DRIVERS } from "./drivers.ts";
import {
  pickPort,
  type SerialLink,
  type SerialPortFactory,
} from "./serial-link.ts";

interface OpenOutput {
  readonly output: Output;
  link: SerialLink | undefined;
  status: OutputStatus;
  /** Frames sent since the last fps sample. */
  sent: number;
  /** A send in flight; the next frame waits so writes never interleave. */
  busy: boolean;
  /** When the last open attempt was made, so a missing widget is retried but not hammered. */
  lastAttemptAt: number;
}

export interface OutputManagerOptions {
  readonly factory: () => Promise<SerialPortFactory>;
  readonly log: (message: string) => void;
  /** How long to wait before looking for a missing widget again. */
  readonly retryMs?: number;
  readonly now?: () => number;
}

/**
 * Keeps one open serial link per Output in the document, sends each
 * Universe's frame through the Outputs that carry it, and reports every
 * Output's status as live state. A widget that is missing or that vanishes
 * is retried without stopping the loop.
 */
export class OutputManager {
  readonly #open = new Map<string, OpenOutput>();
  readonly #options: OutputManagerOptions;
  readonly #listeners = new Set<() => void>();
  #factory: SerialPortFactory | undefined;
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
    const retryMs = this.#options.retryMs ?? 2_000;
    if (this.#now() - entry.lastAttemptAt < retryMs) return;
    entry.lastAttemptAt = this.#now();
    try {
      this.#factory ??= await this.#options.factory();
      const port = pickPort(await this.#factory.list(), entry.output.device);
      if (port === undefined) {
        this.#setStatus(entry, {
          state: "device-missing",
          path: null,
          fps: 0,
          message:
            entry.output.device === "any"
              ? "No serial DMX widget found."
              : `No widget with serial number ${entry.output.device}.`,
        });
        return;
      }
      const link = await this.#factory.open(
        port.path,
        DRIVERS[entry.output.kind].options,
      );
      link.onClose((error) => {
        entry.link = undefined;
        this.#setStatus(entry, {
          state: "device-missing",
          path: null,
          fps: 0,
          message: error?.message ?? "The widget went away.",
        });
      });
      entry.link = link;
      this.#setStatus(entry, { state: "delivering", path: port.path, fps: 0 });
    } catch (error) {
      this.#setStatus(entry, {
        state: "error",
        path: null,
        fps: 0,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Sends each Universe's frame through its Outputs; a slow widget skips frames rather than queueing them. */
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
      DRIVERS[entry.output.kind]
        .send(link, frame)
        .then(() => {
          entry.sent += 1;
        })
        .catch((error: unknown) => {
          this.#setStatus(entry, {
            state: "error",
            path: link.path,
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
