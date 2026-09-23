import {
  createBuiltInRegistry,
  emptyDocument,
  parseFixtureType,
} from "@refrata/core";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import strobeJson from "../../../refrata-library/generic/atomic-like-panel.json" with { type: "json" };
import { serializeDocument } from "../documents/document-file.ts";
import type { DocumentSession } from "../documents/document-session.ts";
import { DocumentStore } from "../documents/document-store.ts";
import { createDrivers } from "../output/drivers.ts";
import { OutputManager } from "../output/output-manager.ts";
import { HighlightTimeout } from "./highlight-timeout.ts";
import { OutputLoop } from "./output-loop.ts";
import { TesterTimeout } from "./tester-timeout.ts";

let dir: string;
let file: string;
let store: DocumentStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "refrata-follow-"));
  file = path.join(dir, "club.refrata");
  store = new DocumentStore({ registry: createBuiltInRegistry() });
});

afterEach(async () => {
  // Some tests leave a dirty document with a path: let its sidecar land before the folder goes.
  await store.flush();
  await rm(dir, { recursive: true, force: true });
});

function run(session: DocumentSession, name: string, payload: unknown): void {
  const result = session.execute(name, payload, "test");
  if (!result.ok) throw new Error(result.error);
}

/** A saved, clean show with one strobe. */
async function savedStrobe(): Promise<DocumentSession> {
  const created = await store.create("Club");
  const session = store.session(created.ok ? created.result.id : "")!;
  const strobe = parseFixtureType(strobeJson);
  if (!strobe.ok) throw new Error(strobe.error);
  run(session, "fixture.create", {
    id: "strobe",
    typeKey: "generic/atomic-like-panel",
    modeKey: "32ch",
    fixtureType: strobe.type,
  });
  expect((await store.save(session.id, file)).ok).toBe(true);
  return session;
}

/** The first edit after a save, then a save: clean to dirty and back. */
async function editAndSave(session: DocumentSession): Promise<void> {
  expect(session.dirty).toBe(false);
  run(session, "controller.create", {
    id: `c${session.revision}`,
    kind: "number",
    name: "Energy",
  });
  expect(session.dirty).toBe(true);
  expect((await store.save(session.id)).ok).toBe(true);
  expect(session.dirty).toBe(false);
}

const highlight = (session: DocumentSession): boolean | undefined =>
  session.document.operational.highlight["strobe/root"];

describe("HighlightTimeout across document changes", () => {
  it("still releases a held highlight after a first edit and a save", async () => {
    const session = await savedStrobe();
    const timeout = new HighlightTimeout(store, 1_000);
    timeout.start();
    run(session, "address.set", {
      address: "element/strobe/root/highlight",
      value: true,
    });
    const since = Date.now();
    await editAndSave(session);
    timeout.sweep(since + 500);
    expect(highlight(session)).toBe(true);
    timeout.sweep(Date.now() + 1_500);
    expect(highlight(session)).toBe(false);
    timeout.close();
  });

  it("still releases a highlight held across a revert in place", async () => {
    const session = await savedStrobe();
    const timeout = new HighlightTimeout(store, 1_000);
    timeout.start();
    run(session, "address.set", {
      address: "element/strobe/root/highlight",
      value: true,
    });
    expect((await store.revert(session.id)).ok).toBe(true);
    expect(store.currentSession()).toBe(session);
    expect(highlight(session)).toBe(true);
    timeout.sweep(Date.now() + 1_500);
    expect(highlight(session)).toBe(false);
    timeout.close();
  });

  it("forgets the holds of a session that was replaced", async () => {
    const session = await savedStrobe();
    const timeout = new HighlightTimeout(store, 1_000);
    timeout.start();
    run(session, "address.set", {
      address: "element/strobe/root/highlight",
      value: true,
    });
    const created = await store.create("Other");
    const next = store.session(created.ok ? created.result.id : "")!;
    const revisions = [session.revision, next.revision];
    timeout.sweep(Date.now() + 1_500);
    expect([session.revision, next.revision]).toEqual(revisions);

    // The new session is followed: a hold in it is released.
    run(next, "fixture.create", {
      id: "strobe",
      typeKey: "generic/atomic-like-panel",
      modeKey: "32ch",
      fixtureType:
        session.document.fixtureTypes["generic/atomic-like-panel"]?.type,
    });
    run(next, "address.set", {
      address: "element/strobe/root/highlight",
      value: true,
    });
    timeout.sweep(Date.now() + 1_500);
    expect(highlight(next)).toBe(false);
    // The replaced session is no longer listened to.
    run(session, "address.set", {
      address: "element/strobe/root/highlight",
      value: false,
    });
    run(session, "address.set", {
      address: "element/strobe/root/highlight",
      value: true,
    });
    timeout.sweep(Date.now() + 1_500);
    expect(highlight(session)).toBe(true);
    timeout.close();
  });

  it("follows a session that took the place of one with the same id", async () => {
    const session = await savedStrobe();
    const timeout = new HighlightTimeout(store, 1_000);
    timeout.start();
    const copy = path.join(dir, "copy.refrata");
    expect((await store.save(session.id, copy)).ok).toBe(true);
    expect((await store.open(file)).ok).toBe(true);
    const next = store.currentSession()!;
    expect(next).not.toBe(session);
    expect(next.id).toBe(session.id);
    run(next, "address.set", {
      address: "element/strobe/root/highlight",
      value: true,
    });
    timeout.sweep(Date.now() + 1_500);
    expect(highlight(next)).toBe(false);
    timeout.close();
  });
});

describe("TesterTimeout across document changes", () => {
  it("still releases a held range after a first edit and a save", async () => {
    const session = await savedStrobe();
    const universeId = Object.keys(session.document.universes)[0] ?? "";
    const timeout = new TesterTimeout(store, 1_000);
    timeout.start();
    run(session, "tester.hold", { universeId, address: 1, count: 3 });
    const since = Date.now();
    await editAndSave(session);
    timeout.sweep(since + 500);
    expect(session.document.operational.tester).not.toBeNull();
    timeout.sweep(Date.now() + 1_500);
    expect(session.document.operational.tester).toBeNull();
    timeout.close();
  });

  it("forgets the range of a session that was replaced", async () => {
    const session = await savedStrobe();
    const universeId = Object.keys(session.document.universes)[0] ?? "";
    const timeout = new TesterTimeout(store, 1_000);
    timeout.start();
    run(session, "tester.hold", { universeId, address: 1, count: 3 });
    const created = await store.create("Other");
    const next = store.session(created.ok ? created.result.id : "")!;
    timeout.sweep(Date.now() + 1_500);
    expect(session.document.operational.tester).not.toBeNull();
    expect(next.revision).toBe(0);
    timeout.close();
  });
});

describe("OutputLoop across document changes", () => {
  it("keeps its Visuals through a save and a first edit, and starts them over with new content", async () => {
    const session = await savedStrobe();
    run(session, "scene.create", { id: "verse", name: "Verse" });
    run(session, "layer.create", {
      id: "fx",
      kind: "visual",
      visual: "chase",
      sceneId: "verse",
      targets: ["strobe/backlight"],
    });
    run(session, "layer.targets.spread", {
      layerId: "fx",
      ref: "strobe/backlight",
      spread: true,
    });
    run(session, "address.edit", { address: "layer/fx/param/rate", value: 0 });

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
    const step = (on: DocumentSession): void =>
      run(on, "address.trigger", { address: "layer/fx/cue/step" });

    step(session);
    expect(litPanels()).toEqual(["strobe/panel-2"]);
    expect((await store.save(session.id)).ok).toBe(true);
    expect(litPanels()).toEqual(["strobe/panel-2"]);
    await editAndSave(session);
    expect(litPanels()).toEqual(["strobe/panel-2"]);

    // A revert in place is new content: its Visuals start over.
    run(session, "controller.create", { id: "x", kind: "number", name: "X" });
    expect(litPanels()).toEqual(["strobe/panel-2"]);
    expect((await store.revert(session.id)).ok).toBe(true);
    expect(store.currentSession()).toBe(session);
    expect(loop.document).toBe(session.document);
    expect(litPanels()).toEqual(["strobe/panel-1"]);

    // The same show under another Installation id takes the session's place.
    step(session);
    expect(litPanels()).toEqual(["strobe/panel-2"]);
    const other = {
      ...session.document,
      installation: {
        ...session.document.installation,
        id: emptyDocument("Other").installation.id,
      },
    };
    expect((await store.replaceContent(serializeDocument(other))).ok).toBe(
      true,
    );
    const next = store.currentSession()!;
    expect(next).not.toBe(session);
    expect(loop.document).toBe(next.document);
    expect(litPanels()).toEqual(["strobe/panel-1"]);
    // Its Cues reach the loop, and the replaced session's no longer do.
    step(next);
    expect(litPanels()).toEqual(["strobe/panel-2"]);
    step(session);
    expect(litPanels()).toEqual(["strobe/panel-2"]);

    expect((await store.close(next.id, true)).ok).toBe(true);
    expect(loop.document).toBeUndefined();
    expect(litPanels()).toEqual([]);
    await loop.close();
  });
});
