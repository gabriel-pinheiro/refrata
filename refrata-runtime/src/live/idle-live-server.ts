import type { DocumentsMode } from "@refrata/protocol";

import type { DocumentStore } from "../documents/document-store.ts";
import { createDrivers } from "../output/drivers.ts";
import { OutputManager } from "../output/output-manager.ts";
import { fakeSerialFactory } from "../output/serial/fake-serial.ts";
import { FixtureLibrary } from "../rig/library.ts";
import { OutputLoop } from "../rig/output-loop.ts";
import { LiveServer } from "./live-server.ts";

/** A LiveServer over `store` with an idle output loop and an empty library, for tests. */
export function idleLiveServer(
  store: DocumentStore,
  log: (message: string) => void,
  documents: DocumentsMode = "free",
): LiveServer {
  const outputs = new OutputManager({
    drivers: createDrivers({
      serial: () => Promise.resolve(fakeSerialFactory([]).factory),
    }),
    log,
  });
  return new LiveServer({
    store,
    runtimeName: "test",
    runtimeVersion: "0",
    documents,
    log,
    library: new FixtureLibrary(log),
    loop: new OutputLoop({ store, outputs }),
    outputs,
  });
}
