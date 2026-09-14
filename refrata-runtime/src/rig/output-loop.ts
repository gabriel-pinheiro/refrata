import {
  resolveDocument,
  settings,
  universeFrames,
  type Document,
  type ResolvedDocument,
} from "@refrata/core";
import type { DmxLive } from "@refrata/protocol";

import type { DocumentStore } from "../documents/document-store.ts";
import type { OutputManager } from "../output/output-manager.ts";

export interface OutputLoopOptions {
  readonly store: DocumentStore;
  readonly outputs: OutputManager;
  readonly rateHz?: number;
}

/**
 * The output loop: at the output rate, resolve the open Installation,
 * encode one DMX Frame per Universe, hand the frames to the Outputs, and
 * keep the latest resolved values for the Resolved Stream and the CLI. It
 * runs whenever an Installation with a Universe is open, Outputs or not.
 */
export class OutputLoop {
  readonly #options: OutputLoopOptions;
  readonly #listeners = new Set<(resolved: ResolvedDocument) => void>();
  readonly #liveListeners = new Set<(live: DmxLive) => void>();
  #timer: ReturnType<typeof setInterval> | undefined;
  #resolved: ResolvedDocument = new Map();
  #frames: ReadonlyMap<string, Uint8Array> = new Map();
  #document: Document | undefined;
  #ticks = 0;
  #sampledAt = Date.now();
  #fps = 0;
  #unsubscribeStore: (() => void) | undefined;
  #unsubscribeDeltas: (() => void) | undefined;

  constructor(options: OutputLoopOptions) {
    this.#options = options;
  }

  get rateHz(): number {
    return this.#options.rateHz ?? settings.output.rateHz;
  }

  live(): DmxLive {
    return { rateHz: this.rateHz, fps: this.#fps };
  }

  /** The latest resolved values, by Element reference. */
  resolved(): ResolvedDocument {
    return this.#resolved;
  }

  /** The latest frame of a Universe, or 512 zeros when it has none. */
  frame(universeId: string): Uint8Array {
    return this.#frames.get(universeId) ?? new Uint8Array(512);
  }

  /** Fires after every tick with the values just resolved. */
  onResolved(listener: (resolved: ResolvedDocument) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  onLive(listener: (live: DmxLive) => void): () => void {
    this.#liveListeners.add(listener);
    return () => this.#liveListeners.delete(listener);
  }

  start(): void {
    this.#follow();
    this.#unsubscribeStore = this.#options.store.onChange(() => this.#follow());
    this.#timer = setInterval(() => this.tick(), 1_000 / this.rateHz);
  }

  /** Follows the store's current document and its Outputs. */
  #follow(): void {
    const session = this.#options.store.currentSession();
    this.#unsubscribeDeltas?.();
    this.#unsubscribeDeltas = session?.onDelta((delta) => {
      if (delta.patches.some((patch) => patch.path[0] === "outputs"))
        void this.#options.outputs.sync(session.document.outputs);
    });
    this.#document = session?.document;
    void this.#options.outputs.sync(session?.document.outputs ?? {});
    // A new document must not keep showing the old one's values.
    this.tick();
  }

  /** One frame: resolve, encode, send, announce. Public so tests step it by hand. */
  tick(): void {
    const session = this.#options.store.currentSession();
    const document = session?.document;
    this.#document = document;
    if (document === undefined) {
      this.#resolved = new Map();
      this.#frames = new Map();
      return;
    }
    this.#resolved = resolveDocument(document);
    this.#frames = universeFrames(document, this.#resolved);
    this.#options.outputs.send(this.#frames);
    this.#ticks += 1;
    const now = Date.now();
    if (now - this.#sampledAt >= 1_000) {
      const fps = Math.round((this.#ticks * 1_000) / (now - this.#sampledAt));
      this.#ticks = 0;
      this.#sampledAt = now;
      if (fps !== this.#fps) {
        this.#fps = fps;
        for (const listener of this.#liveListeners) listener(this.live());
      }
    }
    for (const listener of this.#listeners) listener(this.#resolved);
  }

  get document(): Document | undefined {
    return this.#document;
  }

  async close(): Promise<void> {
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#timer = undefined;
    this.#unsubscribeStore?.();
    this.#unsubscribeDeltas?.();
    await this.#options.outputs.close();
  }
}
