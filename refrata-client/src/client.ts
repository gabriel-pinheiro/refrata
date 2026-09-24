import { settings, type Document } from "@refrata/core";
import {
  ClientMessageSchema,
  PROTOCOL_VERSION,
  ServerMessageSchema,
  type ClientKind,
  type ClientMessage,
  type DocumentSummary,
  type DocumentsMode,
  type RuntimeRequestName,
  type RuntimeRequestPayload,
  type ServerMessage,
} from "@refrata/protocol";

import { DocumentView } from "./document-view.ts";
import { Signal } from "./signal.ts";

export type ConnectionPhase =
  "connecting" | "connected" | "reconnecting" | "closed";

export interface ClientOptions {
  readonly url: string;
  readonly kind: ClientKind;
  readonly name?: string;
  /** Stable owner of undo history across reconnects; defaults to the session id. */
  readonly actor?: string;
  /** Defaults to the global WebSocket (browsers and Node 22+). */
  readonly createSocket?: (url: string) => WebSocket;
  readonly reconnect?: boolean;
  /** Called for input coalescing; defaults to requestAnimationFrame or setTimeout. */
  readonly scheduleFlush?: (flush: () => void) => void;
}

interface PendingRequest {
  resolve(result: unknown): void;
  reject(error: Error): void;
}

/** A refused command or request; `issues` lists payload problems one per line. */
export class CommandError extends Error {
  readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[] = []) {
    super(message);
    this.issues = issues;
  }
}

/**
 * One connection to a runtime. Holds the open document's summary, one
 * DocumentView per subscribed document, acknowledged commands and requests,
 * and a per-frame coalesced input queue (latest value per address wins).
 */
export class RefrataClient {
  readonly phase = new Signal<ConnectionPhase>("connecting");
  readonly sessionId = new Signal<string | undefined>(undefined);
  /**
   * What the runtime lets this connection do with its document: `pinned`
   * refuses new, open, close and save to another path. Undefined until
   * `welcome`.
   */
  readonly documents = new Signal<DocumentsMode | undefined>(undefined);
  /** The runtime's open document, or null. */
  readonly document = new Signal<DocumentSummary | null>(null);
  readonly lastError = new Signal<string | undefined>(undefined);

  readonly #options: ClientOptions;
  readonly #views = new Map<string, DocumentView>();
  readonly #pending = new Map<string, PendingRequest>();
  readonly #inputs = new Map<string, ClientMessage & { type: "input" }>();
  #socket: WebSocket | undefined;
  #flushScheduled = false;
  #closed = false;
  #retryMs: number = settings.client.reconnectInitialMs;
  #requestCounter = 0;

  constructor(options: ClientOptions) {
    this.#options = options;
    this.#connect();
  }

  close(): void {
    this.#closed = true;
    this.phase.set("closed");
    this.#socket?.close();
  }

  /**
   * Returns the replica for a document, subscribing the first time only.
   * Safe to call on every render: later calls are lookups. The client
   * resubscribes by itself after a reconnect and on a revision gap, and
   * drops the view when the runtime replaces the document.
   */
  openDocument(
    documentId: string,
    options: { readonly live?: boolean } = {},
  ): DocumentView {
    const existing = this.#views.get(documentId);
    if (existing !== undefined) return existing;
    const view = new DocumentView(documentId, options);
    this.#views.set(documentId, view);
    this.#subscribe(view);
    return view;
  }

  closeDocument(documentId: string): void {
    if (!this.#views.delete(documentId)) return;
    this.#send({ type: "unsubscribe", documentId });
  }

  view(documentId: string): DocumentView | undefined {
    return this.#views.get(documentId);
  }

  command<TResult = unknown>(
    documentId: string,
    name: string,
    payload: unknown = {},
  ): Promise<TResult> {
    const requestId = this.#nextRequestId();
    return this.#await<TResult>(requestId, {
      type: "command",
      requestId,
      documentId,
      name,
      payload,
    });
  }

  request<
    TResult = unknown,
    TName extends RuntimeRequestName = RuntimeRequestName,
  >(name: TName, payload: RuntimeRequestPayload<TName>): Promise<TResult> {
    const requestId = this.#nextRequestId();
    return this.#await<TResult>(requestId, {
      type: "request",
      requestId,
      name,
      payload,
    });
  }

  /**
   * Names the Fixtures whose resolved values this client wants streamed
   * (the whole set; empty stops the stream). Values land in the document's
   * view under `resolved`. Re-sent by itself after a reconnect.
   */
  stream(documentId: string, fixtureIds: readonly string[]): void {
    const view = this.#views.get(documentId);
    if (view === undefined) return;
    view.setStreamedFixtures(fixtureIds);
    this.#send({ type: "stream", documentId, fixtureIds: [...fixtureIds] });
  }

  /**
   * Names the Universes whose DMX Frames this client wants streamed (the
   * whole set; empty stops the stream). Bytes land in the document's view
   * under `frameOf`. Re-sent by itself after a reconnect.
   */
  frames(documentId: string, universeIds: readonly string[]): void {
    const view = this.#views.get(documentId);
    if (view === undefined) return;
    view.setStreamedUniverses(universeIds);
    this.#send({ type: "frames", documentId, universeIds: [...universeIds] });
  }

  /**
   * Names the Layers whose Geometry Visual pose this client wants streamed
   * (the whole set; empty stops the stream). Poses land in the document's
   * view under `poseOf`. Re-sent by itself after a reconnect.
   */
  poses(documentId: string, layerIds: readonly string[]): void {
    const view = this.#views.get(documentId);
    if (view === undefined) return;
    view.setStreamedLayers(layerIds);
    this.#send({ type: "poses", documentId, layerIds: [...layerIds] });
  }

  /** Latest-wins per address; flushed once per frame. */
  input(documentId: string, address: string, value: unknown): void {
    this.#inputs.set(`${documentId}\u0000${address}`, {
      type: "input",
      documentId,
      address,
      value,
    });
    if (this.#flushScheduled) return;
    this.#flushScheduled = true;
    const schedule =
      this.#options.scheduleFlush ??
      ((flush) => {
        const raf = (
          globalThis as {
            requestAnimationFrame?: (callback: () => void) => number;
          }
        ).requestAnimationFrame;
        if (raf !== undefined) raf(() => flush());
        else setTimeout(flush, 16);
      });
    schedule(() => {
      this.#flushScheduled = false;
      for (const message of this.#inputs.values()) this.#send(message);
      this.#inputs.clear();
    });
  }

  #subscribe(view: DocumentView): void {
    this.#send({
      type: "subscribe",
      documentId: view.documentId,
      ...(view.live ? { live: true } : {}),
    });
    const streamed = view.streamedFixtures();
    if (streamed.length > 0)
      this.#send({
        type: "stream",
        documentId: view.documentId,
        fixtureIds: [...streamed],
      });
    const universes = view.streamedUniverses();
    if (universes.length > 0)
      this.#send({
        type: "frames",
        documentId: view.documentId,
        universeIds: [...universes],
      });
    const layers = view.streamedLayers();
    if (layers.length > 0)
      this.#send({
        type: "poses",
        documentId: view.documentId,
        layerIds: [...layers],
      });
  }

  #nextRequestId(): string {
    this.#requestCounter += 1;
    return `r${this.#requestCounter}`;
  }

  #await<TResult>(requestId: string, message: ClientMessage): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      this.#pending.set(requestId, {
        resolve: (result) => resolve(result as TResult),
        reject,
      });
      if (!this.#send(message)) {
        this.#pending.delete(requestId);
        reject(new CommandError("Not connected to the runtime."));
      }
    });
  }

  #send(message: ClientMessage): boolean {
    if (this.#socket?.readyState !== WebSocket.OPEN) return false;
    this.#socket.send(JSON.stringify(ClientMessageSchema.parse(message)));
    return true;
  }

  #connect(): void {
    if (this.#closed) return;
    const create =
      this.#options.createSocket ?? ((url: string) => new WebSocket(url));
    const socket = create(this.#options.url);
    this.#socket = socket;
    socket.addEventListener("open", () => {
      this.#retryMs = settings.client.reconnectInitialMs;
      const client: { kind: ClientKind; name?: string; actor?: string } = {
        kind: this.#options.kind,
      };
      if (this.#options.name !== undefined) client.name = this.#options.name;
      if (this.#options.actor !== undefined) client.actor = this.#options.actor;
      const hello: ClientMessage = {
        type: "hello",
        protocolVersion: PROTOCOL_VERSION,
        client,
      };
      socket.send(JSON.stringify(hello));
    });
    socket.addEventListener("message", (event) => {
      this.#receive(String(event.data));
    });
    socket.addEventListener("close", () => {
      this.#socket = undefined;
      for (const pending of this.#pending.values())
        pending.reject(new CommandError("Connection closed."));
      this.#pending.clear();
      if (this.#closed || this.#options.reconnect === false) {
        this.phase.set("closed");
        return;
      }
      this.phase.set("reconnecting");
      setTimeout(() => this.#connect(), this.#retryMs);
      this.#retryMs = Math.min(
        this.#retryMs * 2,
        settings.client.reconnectMaxMs,
      );
    });
    socket.addEventListener("error", () => {
      /* close follows */
    });
  }

  #receive(raw: string): void {
    let parsed: ServerMessage;
    try {
      parsed = ServerMessageSchema.parse(JSON.parse(raw));
    } catch (error) {
      this.lastError.set(`Unreadable runtime message: ${String(error)}`);
      return;
    }
    switch (parsed.type) {
      case "welcome":
        this.sessionId.set(parsed.sessionId);
        this.documents.set(parsed.documents);
        this.phase.set("connected");
        for (const view of this.#views.values()) this.#subscribe(view);
        break;
      case "document":
        this.document.set(parsed.summary);
        // Views of a replaced document would never hear from the runtime again.
        for (const documentId of this.#views.keys()) {
          if (documentId !== parsed.summary?.id) this.#views.delete(documentId);
        }
        break;
      case "snapshot":
        this.#views
          .get(parsed.documentId)
          ?.replaceSnapshot(
            parsed.document as Document,
            parsed.revision,
            parsed.live,
          );
        break;
      case "delta": {
        const view = this.#views.get(parsed.documentId);
        if (
          view !== undefined &&
          !view.applyDelta(parsed.patches, parsed.fromRevision, parsed.revision)
        ) {
          this.#subscribe(view);
        }
        break;
      }
      case "live":
        this.#views.get(parsed.documentId)?.applyLive(parsed.patches);
        break;
      case "resolved":
        this.#views
          .get(parsed.documentId)
          ?.applyResolved(parsed.values, parsed.full);
        break;
      case "frame":
        this.#views
          .get(parsed.documentId)
          ?.applyFrame(parsed.universeId, parsed.bytes, parsed.full);
        break;
      case "pose":
        this.#views
          .get(parsed.documentId)
          ?.applyPose(parsed.layerId, parsed.pose);
        break;
      case "event":
        this.#views.get(parsed.documentId)?.receiveEvent(parsed.address);
        break;
      case "reply": {
        const pending = this.#pending.get(parsed.requestId);
        this.#pending.delete(parsed.requestId);
        if (pending === undefined) break;
        if (parsed.outcome.ok) pending.resolve(parsed.outcome.result);
        else
          pending.reject(
            new CommandError(parsed.outcome.error, parsed.outcome.issues),
          );
        break;
      }
      case "error":
        this.lastError.set(parsed.message);
        break;
    }
  }
}
