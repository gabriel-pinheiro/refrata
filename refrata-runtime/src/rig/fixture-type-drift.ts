import { fixtureTypeDrift, type FixtureTypeDrift } from "@refrata/core";

import type { DocumentStore } from "../documents/document-store.ts";
import type { FixtureLibrary } from "./library.ts";

export type FixtureTypeDrifts = Readonly<Record<string, FixtureTypeDrift>>;

/**
 * How each Fixture Type the open Installation holds stands against the
 * library, kept current as the Installation's types change and as library
 * files change on disk, for the live state Studio shows beside the reload
 * buttons.
 */
export class FixtureTypeDriftTracker {
  readonly #store: DocumentStore;
  readonly #library: FixtureLibrary;
  readonly #listeners = new Set<(state: FixtureTypeDrifts) => void>();
  #state: FixtureTypeDrifts = {};
  #unsubscribeStore: (() => void) | undefined;
  #unsubscribeLibrary: (() => void) | undefined;
  #unsubscribeDeltas: (() => void) | undefined;

  constructor(store: DocumentStore, library: FixtureLibrary) {
    this.#store = store;
    this.#library = library;
  }

  start(): void {
    this.#follow();
    this.#unsubscribeStore = this.#store.onChange(() => this.#follow());
    this.#unsubscribeLibrary = this.#library.onChange(() => this.#update());
  }

  state(): FixtureTypeDrifts {
    return this.#state;
  }

  onChange(listener: (state: FixtureTypeDrifts) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #follow(): void {
    this.#unsubscribeDeltas?.();
    this.#unsubscribeDeltas = this.#store.currentSession()?.onDelta((delta) => {
      if (delta.patches.some((patch) => patch.path[0] === "fixtureTypes"))
        this.#update();
    });
    this.#update();
  }

  #update(): void {
    const document = this.#store.currentSession()?.document;
    const next: Record<string, FixtureTypeDrift> = {};
    for (const [key, stored] of Object.entries(document?.fixtureTypes ?? {}))
      next[key] = fixtureTypeDrift(stored.type, this.#library.libraryType(key));
    const keys = Object.keys(next);
    const same =
      keys.length === Object.keys(this.#state).length &&
      keys.every((key) => this.#state[key] === next[key]);
    if (same) return;
    this.#state = next;
    for (const listener of this.#listeners) listener(next);
  }

  close(): void {
    this.#unsubscribeStore?.();
    this.#unsubscribeLibrary?.();
    this.#unsubscribeDeltas?.();
  }
}
