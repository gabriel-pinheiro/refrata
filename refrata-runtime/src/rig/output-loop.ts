import {
  LayerFades,
  resolveDocument,
  settings,
  universeFrames,
  VisualPlayer,
  type Document,
  type ResolvedDocument,
} from "@refrata/core";
import type { DmxLive } from "@refrata/protocol";

import type { DocumentSession } from "../documents/document-session.ts";
import type { DocumentStore } from "../documents/document-store.ts";
import type { OutputManager } from "../output/output-manager.ts";

export interface OutputLoopOptions {
  readonly store: DocumentStore;
  readonly outputs: OutputManager;
  readonly rateHz?: number;
  /** Milliseconds from a steady clock; tests pass their own to step Visuals by hand. */
  readonly now?: () => number;
}

/**
 * The output loop: at the output rate, step the playing Scene's Visuals
 * and Layer Fades, resolve the open Installation with what they wrote,
 * encode one DMX Frame per Universe, hand the frames to the Outputs, and
 * keep the latest resolved values for the Resolved Stream and the CLI. It
 * runs whenever an Installation with a Universe is open, Outputs or not.
 * The Visual instances and the fade envelopes live here and nowhere else:
 * playing a Scene, the playing one included, makes them anew, and a Cue
 * reaches the instance of its Layer.
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
  #followed: DocumentSession | undefined;
  #unsubscribeStore: (() => void) | undefined;
  #unsubscribeDeltas: (() => void) | undefined;
  #unsubscribeEvents: (() => void) | undefined;
  readonly #visuals = new VisualPlayer();
  readonly #fades = new LayerFades();
  #steppedAt: number | undefined;

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

  /** The latest frame of every Universe, by Universe id. */
  frames(): ReadonlyMap<string, Uint8Array> {
    return this.#frames;
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

  /**
   * Follows the store's current document and its Outputs. The store also
   * fires when only the summary changed (a save, the first edit after one),
   * which leaves the Visuals running.
   */
  #follow(): void {
    const session = this.#options.store.currentSession();
    if (session === this.#followed) return;
    this.#followed = session;
    this.#unsubscribeDeltas?.();
    this.#unsubscribeDeltas = session?.onDelta((delta) => {
      if (delta.patches.some((patch) => patch.path[0] === "outputs"))
        void this.#options.outputs.sync(session.document.outputs);
      // Whole tables are set by a replace in place (revert, replace): new
      // content starts its Visuals over, the way a new document does.
      if (delta.patches.some((patch) => patch.path.length === 1)) {
        this.#visuals.restart();
        this.#fades.restart();
        this.tick();
      }
    });
    this.#unsubscribeEvents?.();
    this.#unsubscribeEvents = session?.onEvent(({ address }) => {
      const [table, id = "", kind, key = ""] = address.split("/");
      if (table === "scene" && kind === "play") {
        this.#visuals.restart();
        this.#fades.restart();
      }
      if (table === "layer" && kind === "cue") this.#visuals.cue(id, key);
    });
    this.#visuals.restart();
    this.#fades.restart();
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
    const steppedAt = (
      this.#options.now ?? performance.now.bind(performance)
    )();
    const dt =
      this.#steppedAt === undefined ? 0 : (steppedAt - this.#steppedAt) / 1_000;
    this.#steppedAt = steppedAt;
    if (document === undefined) {
      this.#resolved = new Map();
      this.#frames = new Map();
      return;
    }
    this.#resolved = resolveDocument(
      document,
      this.#visuals.step(document, dt),
      this.#fades.step(document, dt),
    );
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
    this.#unsubscribeEvents?.();
    this.#visuals.restart();
    this.#fades.restart();
    await this.#options.outputs.close();
  }
}
