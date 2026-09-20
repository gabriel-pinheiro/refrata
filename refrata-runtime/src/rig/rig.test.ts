import {
  createBuiltInRegistry,
  parseFixtureType,
  type ParameterValues,
} from "@refrata/core";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import strobeJson from "../../../refrata-core/test-fixtures/atomic-like-panel.json" with { type: "json" };
import { DocumentStore } from "../documents/document-store.ts";
import { ResolvedStream } from "../live/resolved-streams.ts";
import { createDrivers } from "../output/drivers.ts";
import { OutputManager } from "../output/output-manager.ts";
import { fakeSerialFactory, FTDI_PORT } from "../output/serial/fake-serial.ts";
import { HighlightTimeout } from "./highlight-timeout.ts";
import { TesterTimeout } from "./tester-timeout.ts";
import { FixtureTypeDriftTracker } from "./fixture-type-drift.ts";
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
    registry: createBuiltInRegistry(),
  });
  library = new FixtureLibrary(() => undefined);
  await library.load(libraryDir);
  const strobe = parseFixtureType(strobeJson);
  if (!strobe.ok) throw new Error(strobe.error);
  library.add(strobe.type);
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
      typeKey: "generic/atomic-like-panel",
      modeKey: "32ch",
      fixtureType: library.get("generic/atomic-like-panel"),
    },
    "test",
  );
  if (!result.ok) throw new Error(result.error);
  const universeId = Object.keys(session.document.universes)[0] ?? "";
  return { documentId, universeId };
}

describe("FixtureLibrary", () => {
  it("lists the bundled types and an added one with their Modes and footprints", () => {
    const entries = library.list();
    expect(entries.map((entry) => entry.key)).toEqual([
      "generic/atomic-like-panel",
      "generic/dimmer-1ch",
      "generic/moving-head",
      "generic/rgb-3ch",
      "generic/rgb-7ch",
      "generic/rgbw-4ch",
    ]);
    expect(entries.at(2)?.modes).toEqual([
      { key: "8ch", name: "8ch", footprint: 8 },
      { key: "10ch", name: "10ch", footprint: 10 },
    ]);
    expect(library.get("nope")).toBeUndefined();
  });
});

describe("OutputLoop", () => {
  it("resolves, frames every Universe and hands frames to the Outputs", async () => {
    const { documentId, universeId } = await stageStrobe();
    const fake = fakeSerialFactory([FTDI_PORT]);
    const outputs = new OutputManager({
      drivers: createDrivers({ serial: () => Promise.resolve(fake.factory) }),
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

describe("OutputLoop with Visuals", () => {
  it("steps a Chase, delivers a Cue and starts over when the Scene is played again", async () => {
    const { documentId } = await stageStrobe();
    const session = store.session(documentId)!;
    const run = (name: string, payload: unknown): void => {
      const result = session.execute(name, payload, "test");
      if (!result.ok) throw new Error(result.error);
    };
    run("scene.create", { id: "verse", name: "Verse" });
    run("layer.create", {
      id: "fx",
      kind: "visual",
      visual: "chase",
      sceneId: "verse",
      targets: ["strobe/backlight"],
    });
    run("layer.targets.spread", {
      layerId: "fx",
      ref: "strobe/backlight",
      spread: true,
    });
    run("address.edit", { address: "layer/fx/param/rate", value: 0 });

    let clock = 0;
    const outputs = new OutputManager({
      drivers: createDrivers({
        serial: () => Promise.reject(new Error("none")),
      }),
      log: () => undefined,
      retryMs: 0,
    });
    const loop = new OutputLoop({
      store,
      outputs,
      rateHz: 0.001,
      now: () => clock,
    });
    loop.start();
    const litPanels = (): string[] => {
      clock += 25;
      loop.tick();
      return [...loop.resolved()]
        .filter(([, values]) => values.dimmer === 1)
        .map(([ref]) => ref);
    };
    // The first Scene of an Installation plays as soon as it exists.
    expect(litPanels()).toEqual(["strobe/panel-1"]);
    run("address.trigger", { address: "layer/fx/cue/step" });
    expect(litPanels()).toEqual(["strobe/panel-2"]);
    run("address.trigger", { address: "scene/verse/play" });
    expect(litPanels()).toEqual(["strobe/panel-1"]);
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

describe("Fixture Type drift", () => {
  it("marks a held type stale when the library changes, current again after a reload", async () => {
    const { documentId } = await stageStrobe();
    const tracker = new FixtureTypeDriftTracker(store, library);
    const seen: unknown[] = [];
    tracker.onChange((state) => seen.push(state));
    tracker.start();
    expect(tracker.state()).toEqual({ "generic/atomic-like-panel": "current" });
    const edited = structuredClone(
      library.libraryType("generic/atomic-like-panel")!,
    );
    (edited as { notes?: string }).notes = "Edited while probing";
    library.add(edited);
    expect(tracker.state()).toEqual({ "generic/atomic-like-panel": "stale" });
    expect(library.list(store.session(documentId)!.document).at(0)?.stale).toBe(
      true,
    );
    const session = store.session(documentId)!;
    const reloaded = session.execute(
      "fixture.reload",
      { types: [edited] },
      "test",
    );
    if (!reloaded.ok) throw new Error(reloaded.error);
    expect(tracker.state()).toEqual({ "generic/atomic-like-panel": "current" });
    // Starting publishes the first state, then the library edit, then the reload.
    expect(seen).toEqual([
      { "generic/atomic-like-panel": "current" },
      { "generic/atomic-like-panel": "stale" },
      { "generic/atomic-like-panel": "current" },
    ]);
    tracker.close();
  });

  it("reads the folder again when a file under it changes", async () => {
    const folder = path.join(dir, "library");
    await mkdir(folder, { recursive: true });
    const source = await readFile(
      path.join(libraryDir, "generic/rgb-3ch.json"),
      "utf8",
    );
    const file = path.join(folder, "rgb.json");
    await writeFile(file, source);
    const watched = new FixtureLibrary(() => undefined);
    await watched.load(folder);
    watched.watch(folder);
    const changed = new Promise<void>((resolve) =>
      watched.onChange(() => resolve()),
    );
    const json = JSON.parse(source) as { model: string };
    json.model = "RGB 3ch (edited)";
    await writeFile(file, JSON.stringify(json));
    await changed;
    expect(watched.libraryType("generic/rgb-3ch")?.model).toBe(
      "RGB 3ch (edited)",
    );
    watched.close();
  });
});
