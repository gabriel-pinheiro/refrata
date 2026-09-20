import { settings } from "@refrata/core";

import type { DocumentSession } from "../documents/document-session.ts";
import type { DocumentStore } from "../documents/document-store.ts";

/**
 * The DMX Tester's range is held by whoever set it and released by the
 * runtime after `settings.tester.timeoutMs` without a touch, so a closed
 * tab, a closed browser or a crashed client never leaves channels forced.
 * Any tester command counts as a touch, and so does the `tester.touch`
 * request a holder sends on its keepalive.
 */
export class TesterTimeout {
  readonly #store: DocumentStore;
  readonly #timeoutMs: number;
  #touchedAt: number | undefined;
  #timer: ReturnType<typeof setInterval> | undefined;
  #followed: DocumentSession | undefined;
  #unsubscribeStore: (() => void) | undefined;
  #unsubscribeDeltas: (() => void) | undefined;

  constructor(
    store: DocumentStore,
    timeoutMs: number = settings.tester.timeoutMs,
  ) {
    this.#store = store;
    this.#timeoutMs = timeoutMs;
  }

  start(): void {
    this.#follow();
    this.#unsubscribeStore = this.#store.onChange(() => this.#follow());
    this.#timer = setInterval(
      () => this.sweep(),
      Math.max(50, Math.min(1_000, this.#timeoutMs / 4)),
    );
  }

  /** A holder is still there. */
  touch(now = Date.now()): void {
    if (this.#store.currentSession()?.document.operational.tester !== null)
      this.#touchedAt = now;
  }

  /**
   * Follows the open session. The store also fires when only the summary
   * changed (a save, the first edit after one), which keeps what is tracked;
   * another session starts with nothing held, so the old one's range
   * is forgotten.
   */
  #follow(): void {
    const session = this.#store.currentSession();
    if (session === this.#followed) return;
    this.#followed = session;
    this.#unsubscribeDeltas?.();
    this.#touchedAt = undefined;
    this.#unsubscribeDeltas = session?.onDelta((delta) => {
      for (const patch of delta.patches) {
        const [root, table] = patch.path;
        if (root !== "operational" || table !== "tester") continue;
        this.#touchedAt =
          patch.op === "set" && patch.value !== null ? Date.now() : undefined;
      }
    });
  }

  /** Releases the range when it has gone untouched past the timeout. Public so tests call it. */
  sweep(now = Date.now()): void {
    const session = this.#store.currentSession();
    if (session === undefined || this.#touchedAt === undefined) return;
    if (now - this.#touchedAt < this.#timeoutMs) return;
    this.#touchedAt = undefined;
    if (session.document.operational.tester === null) return;
    session.execute("tester.release", {}, "runtime");
  }

  close(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#unsubscribeStore?.();
    this.#unsubscribeDeltas?.();
  }
}
