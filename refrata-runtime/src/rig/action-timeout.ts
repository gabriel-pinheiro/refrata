import { fixtureModeOf } from "@refrata/core";

import type { DocumentSession } from "../documents/document-session.ts";
import type { DocumentStore } from "../documents/document-store.ts";

/**
 * A running Action is ended by the runtime once the seconds its Mode
 * declares have passed, with the same `fixture.action.end` a client could
 * send, under the actor "runtime". Firing it again while it runs restarts
 * the clock.
 */
export class ActionTimeout {
  readonly #store: DocumentStore;
  readonly #startedAt = new Map<string, number>();
  #timer: ReturnType<typeof setInterval> | undefined;
  #followed: DocumentSession | undefined;
  #unsubscribeStore: (() => void) | undefined;
  #unsubscribeDeltas: (() => void) | undefined;

  constructor(store: DocumentStore) {
    this.#store = store;
  }

  start(): void {
    this.#follow();
    this.#unsubscribeStore = this.#store.onChange(() => this.#follow());
    this.#timer = setInterval(() => this.sweep(), 100);
  }

  /** Follows the open session; another session starts with nothing running. */
  #follow(): void {
    const session = this.#store.currentSession();
    if (session === this.#followed) return;
    this.#followed = session;
    this.#unsubscribeDeltas?.();
    this.#startedAt.clear();
    this.#unsubscribeDeltas = session?.onDelta((delta) => {
      for (const patch of delta.patches) {
        const [root, table, ref] = patch.path;
        if (root !== "operational" || table !== "actions" || ref === undefined)
          continue;
        if (patch.op === "set" && patch.value === true)
          this.#startedAt.set(ref, Date.now());
        else this.#startedAt.delete(ref);
      }
    });
  }

  /** Ends every Action whose seconds are up. Public so tests call it. */
  sweep(now = Date.now()): void {
    const session = this.#store.currentSession();
    if (session === undefined) return;
    for (const [ref, since] of this.#startedAt) {
      const slash = ref.lastIndexOf("/");
      const fixtureId = ref.slice(0, slash);
      const key = ref.slice(slash + 1);
      const fixture = session.document.fixtures[fixtureId];
      const action =
        fixture?.kind === "fixture"
          ? fixtureModeOf(session.document, fixture)?.actions[key]
          : undefined;
      if (action !== undefined && now - since < action.seconds * 1000) continue;
      this.#startedAt.delete(ref);
      if (session.document.operational.actions[ref] !== true) continue;
      session.execute("fixture.action.end", { fixtureId, key }, "runtime");
    }
  }

  close(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#unsubscribeStore?.();
    this.#unsubscribeDeltas?.();
  }
}
