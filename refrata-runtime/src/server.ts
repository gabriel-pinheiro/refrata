import { createBuiltInRegistry, settings } from "@refrata/core";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { access } from "node:fs/promises";
import type { AddressInfo } from "node:net";

import type { RuntimeConfig } from "./config.ts";
import { RuntimeAdvertisement } from "./discovery/advertisement.ts";
import { BonjourAnnouncer } from "./discovery/bonjour-announcer.ts";
import { isLoopbackHost } from "./discovery/loopback-host.ts";
import { registerDocumentRoutes } from "./documents/document-routes.ts";
import { DocumentStore } from "./documents/document-store.ts";
import { LiveServer } from "./live/live-server.ts";
import { OscServer } from "./osc/osc-server.ts";
import { createDrivers, type OutputDrivers } from "./output/drivers.ts";
import { OutputManager } from "./output/output-manager.ts";
import { FixtureTypeDriftTracker } from "./rig/fixture-type-drift.ts";
import { ActionTimeout } from "./rig/action-timeout.ts";
import { HighlightTimeout } from "./rig/highlight-timeout.ts";
import { TesterTimeout } from "./rig/tester-timeout.ts";
import { FixtureLibrary } from "./rig/library.ts";
import { OutputLoop } from "./rig/output-loop.ts";

export const RUNTIME_VERSION = "0.1.0";

export interface Runtime {
  readonly app: FastifyInstance;
  readonly store: DocumentStore;
  readonly library: FixtureLibrary;
  readonly loop: OutputLoop;
  listen(): Promise<string>;
  close(): Promise<void>;
}

export interface RuntimeOptions {
  readonly logger?: boolean;
  /** The Output drivers; the real serial and USB modules unless a test supplies fakes. */
  readonly outputDrivers?: OutputDrivers;
}

async function existingDir(
  candidate: string | undefined,
): Promise<string | undefined> {
  if (candidate === undefined) return undefined;
  try {
    await access(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}

export async function buildRuntime(
  config: RuntimeConfig,
  options: RuntimeOptions = {},
): Promise<Runtime> {
  const app = Fastify({ logger: options.logger ?? false });
  const log = (message: string): void => {
    app.log.warn(message);
  };
  const store = new DocumentStore({
    registry: createBuiltInRegistry(),
    autosaveIntervalMs: config.autosaveIntervalMs,
    log,
  });
  const osc =
    config.oscPort === undefined
      ? undefined
      : new OscServer({ store, port: config.oscPort, host: config.host, log });
  const library = new FixtureLibrary(log);
  await library.load(config.libraryDir);
  const outputs = new OutputManager({
    drivers: options.outputDrivers ?? createDrivers(),
    log,
  });
  const loop = new OutputLoop({ store, outputs });
  const highlightTimeout = new HighlightTimeout(store);
  const actionTimeout = new ActionTimeout(store);
  const testerTimeout = new TesterTimeout(store);
  const drift = new FixtureTypeDriftTracker(store, library);
  const live = new LiveServer({
    store,
    runtimeName: "Refrata Runtime",
    runtimeVersion: RUNTIME_VERSION,
    documents: config.documents,
    log,
    osc,
    library,
    loop,
    outputs,
    tester: testerTimeout,
    drift,
  });
  let advertisement: RuntimeAdvertisement | undefined;

  await app.register(fastifyWebsocket);
  app.get("/health", () => ({
    name: "Refrata Runtime",
    version: RUNTIME_VERSION,
    document: store.current()?.name ?? null,
    osc: osc?.state() ?? { port: null, listeners: 0 },
    discovery: advertisement !== undefined,
  }));
  app.get(settings.runtime.livePath, { websocket: true }, (socket, request) => {
    // The socket's own peer, not `request.ip`, which a proxy header can set.
    live.accept(socket, request.socket.remoteAddress);
  });
  registerDocumentRoutes(app, store);

  const studioDist = await existingDir(config.studioDist);
  if (studioDist !== undefined) {
    await app.register(fastifyStatic, {
      root: studioDist,
      prefix: "/studio/",
      decorateReply: true,
    });
    app.get("/", (_request, reply) => reply.redirect("/studio/"));
  }

  return {
    app,
    store,
    library,
    loop,
    async listen() {
      if (config.openPath !== undefined) {
        const opened =
          config.documents === "pinned"
            ? await store.openOrCreate(config.openPath)
            : await store.open(config.openPath);
        // A pinned runtime with no document could never get one.
        if (!opened.ok && config.documents === "pinned")
          throw new Error(opened.error);
        if (!opened.ok) log(`Skipping ${config.openPath}: ${opened.error}`);
        else if (opened.result.recovered)
          log(
            `Recovered unsaved changes for ${config.openPath} from its autosave.`,
          );
      }
      const address = await app.listen({
        host: config.host,
        port: config.port,
      });
      loop.start();
      highlightTimeout.start();
      actionTimeout.start();
      testerTimeout.start();
      drift.start();
      library.watch(config.libraryDir);
      if (osc !== undefined) {
        try {
          await osc.start();
        } catch (error) {
          log(`OSC is off: ${String(error)}`);
        }
      }
      // A runtime bound to loopback is out of the network's reach.
      if (config.discovery && !isLoopbackHost(config.host)) {
        const { port } = app.server.address() as AddressInfo;
        advertisement = new RuntimeAdvertisement({
          store,
          version: RUNTIME_VERSION,
          announcer: new BonjourAnnouncer({ port, log }),
        });
      }
      return address;
    },
    async close() {
      live.close();
      highlightTimeout.close();
      actionTimeout.close();
      testerTimeout.close();
      drift.close();
      library.close();
      await loop.close();
      await osc?.close();
      await advertisement?.close();
      await store.flush();
      await app.close();
    },
  };
}
