import { fixtureTypeStanding, type FixtureTypeStanding } from "@refrata/core";

import type { DocumentStore } from "../documents/document-store.ts";
import type { FixtureLibrary } from "./library.ts";

export type FixtureTypeStandings = Readonly<
  Record<string, FixtureTypeStanding>
>;

/**
 * How each Fixture Type of the open Installation that came from the
 * library stands against it, kept current as the Installation's types
 * change and as library files change on disk, for the live state the
 * Fixture Editor shows. A type from a file or made in the Installation has
 * no standing and is left out.
 */
export class FixtureTypeStandingTracker {
  readonly #store: DocumentStore;
  readonly #library: FixtureLibrary;
  readonly #listeners = new Set<(state: FixtureTypeStandings) => void>();
  #state: FixtureTypeStandings = {};
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

  state(): FixtureTypeStandings {
    return this.#state;
  }

  onChange(listener: (state: FixtureTypeStandings) => void): () => void {
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
    const next: Record<string, FixtureTypeStanding> = {};
    for (const [key, stored] of Object.entries(document?.fixtureTypes ?? {})) {
      const standing = fixtureTypeStanding(stored, this.#library.get(key));
      if (standing !== undefined) next[key] = standing;
    }
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
