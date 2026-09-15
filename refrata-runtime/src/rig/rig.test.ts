import { createBuiltInRegistry, type ParameterValues } from "@refrata/core";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DocumentStore } from "../documents/document-store.ts";
import { ResolvedStream } from "../live/resolved-streams.ts";
import { fakeSerialFactory, FTDI_PORT } from "../output/fake-serial.ts";
import { OutputManager } from "../output/output-manager.ts";
import { HighlightTimeout } from "./highlight-timeout.ts";
import { TesterTimeout } from "./tester-timeout.ts";
import { FixtureLibrary } from "./library.ts";
import { OutputLoop } from "./output-loop.ts";

const libraryDir = fileURLToPath(
  new URL("../../../refrata-library/", import.meta.url),
);

let dir: string;
let store: DocumentStore;
let library: FixtureLibrary;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "refrata-rig-"));
  store = new DocumentStore({
    projectsDir: dir,
    registry: createBuiltInRegistry(),
  });
  library = new FixtureLibrary(() => undefined);
  await library.load(libraryDir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function stageStrobe(): Promise<{
  documentId: string;
  universeId: string;
}> {
  const created = await store.create("Club");
  const documentId = created.ok ? created.result.id : "";
  const session = store.session(documentId)!;
  const result = session.execute(
    "fixture.create",
    {
      id: "strobe",
      typeKey: "showtech/st-960",
      modeKey: "32ch",
      fixtureType: library.get("showtech/st-960"),
    },
    "test",
  );
  if (!result.ok) throw new Error(result.error);
  const universeId = Object.keys(session.document.universes)[0] ?? "";
  return { documentId, universeId };
}

describe("FixtureLibrary", () => {
  it("lists the bundled types with their Modes and footprints", () => {
    const entries = library.list();
    expect(entries.map((entry) => entry.key)).toEqual([
      "generic/dimmer-1ch",
      "generic/rgb-3ch",
      "generic/rgbw-4ch",
      "showtech/st-960",
    ]);
    expect(entries.at(-1)?.modes).toEqual([
      { key: "3ch", name: "3ch", footprint: 3 },
      { key: "32ch", name: "32ch", footprint: 32 },
    ]);
    expect(library.get("nope")).toBeUndefined();
  });
});

describe("OutputLoop", () => {
  it("resolves, frames every Universe and hands frames to the Outputs", async () => {
    const { documentId, universeId } = await stageStrobe();
    const fake = fakeSerialFactory([FTDI_PORT]);
    const outputs = new OutputManager({
      factory: () => Promise.resolve(fake.factory),
      log: () => undefined,
      retryMs: 0,
    });
    const loop = new OutputLoop({ store, outputs });
    const session = store.session(documentId)!;
    session.execute(
      "output.create",
      { id: "o", universeId, kind: "enttec-usb-pro" },
      "test",
    );
    await outputs.sync(session.document.outputs);
    loop.tick();
    expect(loop.frame(universeId)).toHaveLength(512);
    expect(loop.resolved().get("strobe/panel-1")).toEqual({
      dimmer: 0,
      color: [0, 0, 0, 1],
    });
    session.execute(
      "address.set",
      { address: "element/strobe/section-2/highlight", value: true },
      "test",
    );
    loop.tick();
    expect(loop.frame(universeId)[25]).toBe(255);
    expect(loop.frame(universeId)[24]).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(fake.links[0]?.log.length).toBeGreaterThan(0);
    await loop.close();
  });
});

describe("ResolvedStream", () => {
  it("sends everything for the named Fixtures first, then only changes", () => {
    const sent: { full: boolean; values: Record<string, ParameterValues> }[] =
      [];
    const stream = new ResolvedStream((message) => sent.push(message), 1_000);
    const first = new Map<string, ParameterValues>([
      ["a/root", { dimmer: 0 }],
      ["b/root", { dimmer: 0 }],
    ]);
    stream.setFixtures(["a"], first);
    expect(sent).toEqual([{ full: true, values: { "a/root": { dimmer: 0 } } }]);
    stream.update(first);
    stream.flush();
    expect(sent).toHaveLength(1);
    stream.update(
      new Map([
        ["a/root", { dimmer: 1 }],
        ["b/root", { dimmer: 1 }],
      ]),
    );
    stream.flush();
    expect(sent[1]).toEqual({
      full: false,
      values: { "a/root": { dimmer: 1 } },
    });
    stream.setFixtures([], first);
    stream.flush();
    expect(sent).toHaveLength(2);
    stream.close();
  });
});

describe("HighlightTimeout", () => {
  it("releases a highlight held past the timeout", async () => {
    const { documentId } = await stageStrobe();
    const timeout = new HighlightTimeout(store, 1_000);
    timeout.start();
    const session = store.session(documentId)!;
    session.execute(
      "address.set",
      { address: "element/strobe/root/highlight", value: true },
      "test",
    );
    const since = Date.now();
    timeout.sweep(since + 500);
    expect(session.document.operational.highlight["strobe/root"]).toBe(true);
    timeout.sweep(since + 1_500);
    expect(session.document.operational.highlight["strobe/root"]).toBe(false);
    timeout.close();
  });
});

describe("TesterTimeout", () => {
  it("releases the range when nobody touches it, and a touch keeps it", async () => {
    const { documentId, universeId } = await stageStrobe();
    const timeout = new TesterTimeout(store, 1_000);
    timeout.start();
    const session = store.session(documentId)!;
    session.execute(
      "tester.hold",
      { universeId, address: 1, count: 3 },
      "test",
    );
    const since = Date.now();
    timeout.sweep(since + 800);
    expect(session.document.operational.tester).not.toBeNull();
    timeout.touch(since + 900);
    timeout.sweep(since + 1_500);
    expect(session.document.operational.tester).not.toBeNull();
    timeout.sweep(since + 2_000);
    expect(session.document.operational.tester).toBeNull();
    timeout.close();
  });
});
