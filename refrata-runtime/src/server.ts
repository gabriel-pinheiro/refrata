import { createBuiltInRegistry, settings } from "@refrata/core";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { access } from "node:fs/promises";

import type { RuntimeConfig } from "./config.ts";
import { DocumentStore } from "./documents/document-store.ts";
import { LiveServer } from "./live/live-server.ts";
import { OscServer } from "./osc/osc-server.ts";
import { OutputManager } from "./output/output-manager.ts";
import {
  nodeSerialFactory,
  type SerialPortFactory,
} from "./output/serial-link.ts";
import { HighlightTimeout } from "./rig/highlight-timeout.ts";
import { FixtureLibrary } from "./rig/library.ts";
import { OutputLoop } from "./rig/output-loop.ts";

export const RUNTIME_VERSION = "0.0.0";

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
  /** Serial ports to open Outputs on; the real `serialport` module unless a test supplies a fake. */
  readonly serialFactory?: () => Promise<SerialPortFactory>;
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
    projectsDir: config.projectsDir,
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
    factory: options.serialFactory ?? nodeSerialFactory,
    log,
  });
  const loop = new OutputLoop({ store, outputs });
  const highlightTimeout = new HighlightTimeout(store);
  const live = new LiveServer({
    store,
    runtimeName: "Refrata Runtime",
    runtimeVersion: RUNTIME_VERSION,
    log,
    osc,
    library,
    loop,
    outputs,
  });

  await app.register(fastifyWebsocket);
  app.get("/health", () => ({
    name: "Refrata Runtime",
    version: RUNTIME_VERSION,
    document: store.current()?.name ?? null,
    osc: osc?.state() ?? { port: null, listeners: 0 },
  }));
  app.get(settings.runtime.livePath, { websocket: true }, (socket) => {
    live.accept(socket);
  });

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
        const opened = await store.open(config.openPath);
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
      if (osc !== undefined) {
        try {
          await osc.start();
        } catch (error) {
          log(`OSC is off: ${String(error)}`);
        }
      }
      return address;
    },
    async close() {
      live.close();
      highlightTimeout.close();
      await loop.close();
      await osc?.close();
      await store.flush();
      await app.close();
    },
  };
}
