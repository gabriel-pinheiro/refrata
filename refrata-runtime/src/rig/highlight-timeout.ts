import { settings } from "@refrata/core";

import type { DocumentSession } from "../documents/document-session.ts";
import type { DocumentStore } from "../documents/document-store.ts";

/**
 * A held highlight is released by the runtime after `settings.highlight.
 * timeoutMs`, in case the client that held it vanished mid-press. The
 * release is the same `address.set` the client would have sent, under the
 * actor "runtime".
 */
export class HighlightTimeout {
  readonly #store: DocumentStore;
  readonly #timeoutMs: number;
  readonly #heldSince = new Map<string, number>();
  #timer: ReturnType<typeof setInterval> | undefined;
  #followed: DocumentSession | undefined;
  #unsubscribeStore: (() => void) | undefined;
  #unsubscribeDeltas: (() => void) | undefined;

  constructor(
    store: DocumentStore,
    timeoutMs: number = settings.highlight.timeoutMs,
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

  /**
   * Follows the open session. The store also fires when only the summary
   * changed (a save, the first edit after one), which keeps what is tracked;
   * another session starts with nothing held, so the old one's holds
   * are forgotten.
   */
  #follow(): void {
    const session = this.#store.currentSession();
    if (session === this.#followed) return;
    this.#followed = session;
    this.#unsubscribeDeltas?.();
    this.#heldSince.clear();
    this.#unsubscribeDeltas = session?.onDelta((delta) => {
      for (const patch of delta.patches) {
        const [root, table, ref] = patch.path;
        if (
          root !== "operational" ||
          table !== "highlight" ||
          ref === undefined
        )
          continue;
        if (patch.op === "set" && patch.value === true)
          this.#heldSince.set(ref, Date.now());
        else this.#heldSince.delete(ref);
      }
    });
  }

  /** Releases every highlight held longer than the timeout. Public so tests call it. */
  sweep(now = Date.now()): void {
    const session = this.#store.currentSession();
    if (session === undefined) return;
    for (const [ref, since] of this.#heldSince) {
      if (now - since < this.#timeoutMs) continue;
      this.#heldSince.delete(ref);
      if (session.document.operational.highlight[ref] !== true) continue;
      session.execute(
        "address.set",
        { address: `element/${ref}/highlight`, value: false },
        "runtime",
      );
    }
  }

  close(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#unsubscribeStore?.();
    this.#unsubscribeDeltas?.();
  }
}
