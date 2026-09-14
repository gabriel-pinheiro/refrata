import {
  applyPatches,
  getAtPath,
  pathsOverlap,
  type Document,
  type ParameterValues,
  type Patch,
  type PatchPath,
} from "@refrata/core";
import {
  EMPTY_LIVE_STATE,
  type LiveState,
  type ResolvedValues,
} from "@refrata/protocol";

import { Signal, type ReadonlySignal } from "./signal.ts";

/** Root segment under which the live state is addressed in paths. */
export const LIVE_ROOT = "live";

/**
 * The client-side replica of one Document, plus its live state when the view
 * was opened with `live`. Listeners subscribe to a path and are notified only
 * when a change touches it, so a control bound to `["controllers", id, "name"]`
 * re-renders for that value alone. Live values sit under the `live` root:
 * `["live", "osc"]`.
 */
export class DocumentView {
  readonly documentId: string;
  /** Whether the runtime was asked for live state. */
  readonly live: boolean;
  readonly document: Signal<Document | undefined>;
  readonly liveState: Signal<LiveState>;
  readonly revision: Signal<number>;
  readonly #pathListeners = new Map<string, Set<() => void>>();
  readonly #eventListeners = new Set<(address: string) => void>();
  /** Resolved values by Element reference, for the Fixtures being streamed. */
  #resolved = new Map<string, ParameterValues>();
  readonly #resolvedListeners = new Map<string, Set<() => void>>();
  #streamed: readonly string[] = [];

  constructor(documentId: string, options: { readonly live?: boolean } = {}) {
    this.documentId = documentId;
    this.live = options.live ?? false;
    this.document = new Signal<Document | undefined>(undefined);
    this.liveState = new Signal<LiveState>(EMPTY_LIVE_STATE);
    this.revision = new Signal(0);
  }

  get(): Document | undefined {
    return this.document.get();
  }

  valueAt<TValue = unknown>(path: PatchPath): TValue | undefined {
    const [root, ...rest] = path;
    const source = root === LIVE_ROOT ? this.liveState.get() : undefined;
    if (source !== undefined)
      return getAtPath(source, rest) as TValue | undefined;
    return getAtPath(this.document.get(), path) as TValue | undefined;
  }

  /** Notifies when any change overlaps `path` (ancestor or descendant). */
  subscribePath(path: PatchPath, listener: () => void): () => void {
    const key = path.join("/");
    let listeners = this.#pathListeners.get(key);
    if (listeners === undefined) {
      listeners = new Set();
      this.#pathListeners.set(key, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#pathListeners.delete(key);
    };
  }

  /** Notifies of every trigger Address fired in this document. */
  subscribeEvents(listener: (address: string) => void): () => void {
    this.#eventListeners.add(listener);
    return () => this.#eventListeners.delete(listener);
  }

  /** @internal The runtime announced a fired trigger Address. */
  receiveEvent(address: string): void {
    for (const listener of this.#eventListeners) listener(address);
  }

  /** The latest resolved values of one Element, or undefined while nothing streamed it. */
  resolvedAt(ref: string): ParameterValues | undefined {
    return this.#resolved.get(ref);
  }

  /** Notifies when the resolved values of `ref` change (every Element when `ref` is "*"). */
  subscribeResolved(ref: string, listener: () => void): () => void {
    let listeners = this.#resolvedListeners.get(ref);
    if (listeners === undefined) {
      listeners = new Set();
      this.#resolvedListeners.set(ref, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#resolvedListeners.delete(ref);
    };
  }

  /** A signal-like view of one Element's resolved values. */
  resolved(ref: string): ReadonlySignal<ParameterValues | undefined> {
    return {
      get: () => this.#resolved.get(ref),
      subscribe: (listener) =>
        this.subscribeResolved(ref, () => {
          listener(this.#resolved.get(ref));
        }),
    };
  }

  /** @internal Which Fixtures the client asked to stream, for resubscribing. */
  streamedFixtures(): readonly string[] {
    return this.#streamed;
  }

  /** @internal */
  setStreamedFixtures(fixtureIds: readonly string[]): void {
    this.#streamed = [...fixtureIds];
  }

  /** @internal A `resolved` message: everything when `full`, changes otherwise. */
  applyResolved(values: ResolvedValues, full: boolean): void {
    const changed = new Set<string>(Object.keys(values));
    if (full) {
      for (const ref of this.#resolved.keys()) changed.add(ref);
      this.#resolved = new Map(Object.entries(values));
    } else {
      for (const [ref, value] of Object.entries(values))
        this.#resolved.set(ref, value);
    }
    for (const ref of changed)
      for (const listener of this.#resolvedListeners.get(ref) ?? []) listener();
    for (const listener of this.#resolvedListeners.get("*") ?? []) listener();
  }

  /** A signal-like view of one path, for framework bindings. */
  at<TValue = unknown>(path: PatchPath): ReadonlySignal<TValue | undefined> {
    return {
      get: () => this.valueAt<TValue>(path),
      subscribe: (listener) =>
        this.subscribePath(path, () => {
          listener(this.valueAt<TValue>(path));
        }),
    };
  }

  replaceSnapshot(
    document: Document,
    revision: number,
    live: LiveState = EMPTY_LIVE_STATE,
  ): void {
    this.document.set(document);
    this.liveState.set(live);
    this.revision.set(revision);
    for (const listeners of this.#pathListeners.values()) {
      for (const listener of listeners) listener();
    }
  }

  /** Returns false on a revision gap; the caller must resubscribe. */
  applyDelta(
    patches: readonly Patch[],
    fromRevision: number,
    revision: number,
  ): boolean {
    const current = this.document.get();
    if (current === undefined || fromRevision !== this.revision.get())
      return false;
    this.document.set(applyPatches(current, patches));
    this.revision.set(revision);
    this.#notify(patches.map((patch) => patch.path));
    return true;
  }

  /** Live patches are relative to the live root and carry no revision. */
  applyLive(patches: readonly Patch[]): void {
    this.liveState.set(applyPatches(this.liveState.get(), patches));
    this.#notify(patches.map((patch) => [LIVE_ROOT, ...patch.path]));
  }

  #notify(changed: readonly PatchPath[]): void {
    for (const [key, listeners] of this.#pathListeners) {
      const path = key === "" ? [] : key.split("/");
      if (changed.some((candidate) => pathsOverlap(candidate, path))) {
        for (const listener of listeners) listener();
      }
    }
  }
}
