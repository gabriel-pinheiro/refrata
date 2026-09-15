import { RefrataClient } from "@refrata/client";
import {
  createBuiltInRegistry,
  defineCommand,
  type CommandDefinition,
  type FixtureType,
} from "@refrata/core";
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from "@refrata/protocol";
import { EventEmitter } from "node:events";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import { z } from "zod";

import { DocumentStore } from "../documents/document-store.ts";
import { OutputManager } from "../output/output-manager.ts";
import { fakeSerialFactory } from "../output/fake-serial.ts";
import { FixtureLibrary } from "../rig/library.ts";
import { OutputLoop } from "../rig/output-loop.ts";
import { buildRuntime, type Runtime } from "../server.ts";
import { LiveServer } from "./live-server.ts";

/** A LiveServer over `store` with an idle output loop and an empty library. */
function liveServer(
  store: DocumentStore,
  log: (message: string) => void,
): LiveServer {
  const outputs = new OutputManager({
    factory: () => Promise.resolve(fakeSerialFactory([]).factory),
    log,
  });
  return new LiveServer({
    store,
    runtimeName: "test",
    runtimeVersion: "0",
    log,
    library: new FixtureLibrary(log),
    loop: new OutputLoop({ store, outputs }),
    outputs,
  });
}

/** A `ws` socket as the LiveServer sees it, driven from the test. */
class FakeSocket extends EventEmitter {
  readonly OPEN = 1;
  readyState = this.OPEN;
  readonly sent: ServerMessage[] = [];

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ServerMessage);
  }

  close(): void {
    this.readyState = 3;
    this.emit("close");
  }

  receive(message: ClientMessage): void {
    this.emit("message", Buffer.from(JSON.stringify(message)));
  }

  reply(requestId: string): Extract<ServerMessage, { type: "reply" }> {
    const found = this.sent.find(
      (message) => message.type === "reply" && message.requestId === requestId,
    );
    if (found?.type !== "reply") throw new Error(`No reply to ${requestId}.`);
    return found;
  }
}

let dir: string;
let runtime: Runtime;
let url: string;
const rgbType = rgbJson as unknown as FixtureType;

function waitFor<TValue>(
  read: () => TValue | undefined,
  timeoutMs = 2_000,
): Promise<TValue> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = (): void => {
      const value = read();
      if (value !== undefined) resolve(value);
      else if (Date.now() - started > timeoutMs)
        reject(new Error("Timed out."));
      else setTimeout(tick, 10);
    };
    tick();
  });
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "refrata-live-"));
  runtime = await buildRuntime({
    host: "127.0.0.1",
    port: 0,
    projectsDir: dir,
    openPath: undefined,
    studioDist: undefined,
    libraryDir: path.join(dir, "no-library"),
    autosaveIntervalMs: 60_000,
    oscPort: undefined,
  });
  const address = await runtime.listen();
  url = `${address.replace("http", "ws")}/live`;
});

afterEach(async () => {
  await runtime.close();
  await rm(dir, { recursive: true, force: true });
});

describe("live protocol", () => {
  it("replicates commands as deltas to every subscriber and supports undo", async () => {
    const studio = new RefrataClient({
      url,
      kind: "studio",
      reconnect: false,
      scheduleFlush: (flush) => setTimeout(flush, 0),
    });
    const cli = new RefrataClient({ url, kind: "cli", reconnect: false });
    await waitFor(() =>
      studio.phase.get() === "connected" ? true : undefined,
    );
    await waitFor(() => (cli.phase.get() === "connected" ? true : undefined));

    const created = await studio.request<{ id: string }>("documents.new", {
      name: "Living",
    });
    await waitFor(() => cli.document.get() ?? undefined);

    const studioView = studio.openDocument(created.id);
    const cliView = cli.openDocument(created.id);
    await waitFor(() => cliView.get());

    const names: (string | undefined)[] = [];
    cliView.subscribePath(["controllers"], () =>
      names.push(
        Object.values(cliView.get()?.controllers ?? {})
          .map((c) => c.name)
          .join(","),
      ),
    );

    const reply = await studio.command<{ revision: number; changed: boolean }>(
      created.id,
      "controller.create",
      { id: "energy", kind: "number", name: "Energy" },
    );
    expect(reply).toMatchObject({ revision: 1, changed: true });
    // The caller's own delta precedes its reply, so the view already has it.
    expect(studioView.get()?.controllers.energy?.name).toBe("Energy");
    await waitFor(() => (cliView.revision.get() === 1 ? true : undefined));
    expect(names).toEqual(["Energy"]);

    // Performance input: no reply, replicated, not undoable.
    studio.input(created.id, "controller/energy/value", 0.5);
    await waitFor(() => {
      const energy = cliView.get()?.controllers.energy;
      return energy?.kind === "number" && energy.value === 0.5
        ? true
        : undefined;
    });
    studio.input(created.id, "installation/blackout", true);
    await waitFor(() =>
      cliView.get()?.operational.blackout === true ? true : undefined,
    );
    expect(studioView.get()?.operational.blackout).toBe(true);

    const undo = await studio.command<{ label: string }>(
      created.id,
      "history.undo",
      {},
    );
    expect(undo.label).toBe("Add Number Controller");
    await waitFor(() =>
      cliView.get()?.controllers.energy === undefined ? true : undefined,
    );
    expect(cliView.get()?.operational.blackout).toBe(true);

    await expect(
      studio.command(created.id, "controller.rename", {
        controllerId: "missing",
        name: "x",
      }),
    ).rejects.toThrow("does not exist");

    studio.close();
    cli.close();
  });

  it("sends live state only to subscribers that asked for it", async () => {
    const studio = new RefrataClient({
      url,
      kind: "studio",
      reconnect: false,
    });
    const cli = new RefrataClient({ url, kind: "cli", reconnect: false });
    await waitFor(() =>
      studio.phase.get() === "connected" && cli.phase.get() === "connected"
        ? true
        : undefined,
    );
    const created = await studio.request<{ id: string }>("documents.new", {
      name: "Living",
    });
    await waitFor(() => cli.document.get() ?? undefined);
    const studioView = studio.openDocument(created.id, { live: true });
    const cliView = cli.openDocument(created.id);
    await waitFor(() => studioView.get());
    await waitFor(() => cliView.get());
    // OSC is off in this runtime, so the live state is the empty door.
    expect(studioView.liveState.get()).toEqual({
      osc: { port: null, listeners: 0 },
      outputs: {},
      dmx: { rateHz: 40, fps: 0 },
      fixtureTypes: {},
    });
    expect(studioView.valueAt(["live", "osc", "port"])).toBeNull();
    expect(cliView.liveState.get()).toEqual({
      osc: { port: null, listeners: 0 },
      outputs: {},
      dmx: { rateHz: 0, fps: 0 },
      fixtureTypes: {},
    });
    studio.close();
    cli.close();
  });

  it("streams resolved values, answers frame and library requests", async () => {
    runtime.library.add(rgbType);
    const studio = new RefrataClient({ url, kind: "studio", reconnect: false });
    await waitFor(() =>
      studio.phase.get() === "connected" ? true : undefined,
    );
    const created = await studio.request<{ id: string }>("documents.new", {
      name: "Club",
    });
    const view = studio.openDocument(created.id, { live: true });
    await waitFor(() => view.get());
    const listed = await studio.request<{ types: { key: string }[] }>(
      "library.list",
      {},
    );
    expect(listed.types.map((type) => type.key)).toEqual(["generic/rgb-3ch"]);
    const fetched = await studio.request<{ type: { key: string } }>(
      "library.get",
      { key: "generic/rgb-3ch" },
    );
    expect(fetched.type.key).toBe("generic/rgb-3ch");
    await studio.command(created.id, "fixture.create", {
      id: "par",
      typeKey: "generic/rgb-3ch",
      modeKey: "3ch",
      fixtureType: fetched.type,
    });
    const universeId = Object.keys(view.get()?.universes ?? {})[0] ?? "";
    studio.stream(created.id, ["par"]);
    await waitFor(() => view.resolvedAt("par/root"));
    expect(view.resolvedAt("par/root")).toEqual({
      dimmer: 0,
      color: [0, 0, 0, 1],
    });
    studio.input(created.id, "element/par/root/highlight", true);
    await waitFor(() =>
      view.resolvedAt("par/root")?.dimmer === 1 ? true : undefined,
    );
    const frame = await studio.request<{ bytes: number[] }>("dmx.frame", {
      documentId: created.id,
      universeId,
    });
    expect(frame.bytes.slice(0, 4)).toEqual([255, 255, 255, 0]);
    expect(frame.bytes).toHaveLength(512);
    studio.close();
  });

  it("replaces the document and refuses to drop unsaved changes silently", async () => {
    const studio = new RefrataClient({
      url,
      kind: "studio",
      reconnect: false,
    });
    await waitFor(() =>
      studio.phase.get() === "connected" ? true : undefined,
    );
    const first = await studio.request<{ id: string }>("documents.new", {
      name: "First",
    });
    await expect(
      studio.request("documents.new", { name: "Second" }),
    ).rejects.toThrow("unsaved changes");
    const second = await studio.request<{ id: string }>("documents.new", {
      name: "Second",
      discard: true,
    });
    await waitFor(() =>
      studio.document.get()?.id === second.id ? true : undefined,
    );
    expect(second.id).not.toBe(first.id);
    studio.close();
  });

  it("announces a Macro's run to every subscriber without storing an event", async () => {
    const studio = new RefrataClient({
      url,
      kind: "studio",
      reconnect: false,
    });
    const cli = new RefrataClient({ url, kind: "cli", reconnect: false });
    await waitFor(() =>
      studio.phase.get() === "connected" && cli.phase.get() === "connected"
        ? true
        : undefined,
    );
    const created = await studio.request<{ id: string }>("documents.new", {
      name: "Living",
    });
    await waitFor(() => cli.document.get() ?? undefined);
    const cliView = cli.openDocument(created.id);
    await waitFor(() => cliView.get());
    const heard: string[] = [];
    cliView.subscribeEvents((address) => heard.push(address));
    await studio.command(created.id, "macro.create", {
      id: "hit",
      name: "Hit",
    });
    await studio.command(created.id, "macro.actions.add", {
      macroId: "hit",
      actions: [{ kind: "set", address: "installation/blackout", value: true }],
    });
    const before = await studio.command<{ revision: number }>(
      created.id,
      "address.trigger",
      { address: "macro/hit/run" },
    );
    await waitFor(() =>
      cliView.get()?.operational.blackout === true ? true : undefined,
    );
    // A Macro's run is performed, not announced: its writes arrive as deltas.
    expect(heard).toEqual([]);
    expect(before.revision).toBe(cliView.revision.get());
    await expect(
      studio.command(created.id, "address.trigger", {
        address: "macro/nope/run",
      }),
    ).rejects.toThrow("Unknown address");
    studio.close();
    cli.close();
  });

  it("answers a command whose apply throws with ok:false and keeps serving", async () => {
    const registry = createBuiltInRegistry();
    registry.register(
      defineCommand({
        name: "test.explode",
        kind: "authoring",
        description: "Throws inside apply.",
        payload: z.object({}).strict(),
        apply() {
          throw new Error("boom");
        },
      }) as unknown as CommandDefinition<never>,
    );
    const store = new DocumentStore({ projectsDir: dir, registry });
    const logged: string[] = [];
    const live = liveServer(store, (message) => logged.push(message));
    const created = await store.create("Living");
    const documentId = created.ok ? created.result.id : "";
    const socket = new FakeSocket();
    live.accept(socket as unknown as WebSocket);
    socket.receive({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      client: { kind: "cli" },
    });

    socket.receive({
      type: "command",
      requestId: "r1",
      documentId,
      name: "test.explode",
      payload: {},
    });
    expect(socket.reply("r1").outcome).toEqual({
      ok: false,
      error: "Command “test.explode” failed inside the runtime: boom",
    });
    expect(logged).toEqual(["command “test.explode” threw: boom"]);

    socket.receive({
      type: "command",
      requestId: "r2",
      documentId,
      name: "controller.create",
      payload: { id: "energy", kind: "number", name: "Energy" },
    });
    expect(socket.reply("r2").outcome).toEqual({
      ok: true,
      result: {
        revision: 1,
        changed: true,
        label: "Add Number Controller",
        created: [{ table: "controllers", id: "energy" }],
      },
    });
    expect(socket.readyState).toBe(socket.OPEN);
    live.close();
  });

  it("replies with every payload issue, for commands and requests alike", async () => {
    const store = new DocumentStore({
      projectsDir: dir,
      registry: createBuiltInRegistry(),
    });
    const live = liveServer(store, () => undefined);
    const created = await store.create("Living");
    const documentId = created.ok ? created.result.id : "";
    const socket = new FakeSocket();
    live.accept(socket as unknown as WebSocket);
    socket.receive({
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      client: { kind: "cli" },
    });
    socket.receive({
      type: "command",
      requestId: "r1",
      documentId,
      name: "controller.create",
      payload: { kind: "number", name: 3, limitPixelRatio: "yes" },
    });
    expect(socket.reply("r1").outcome).toEqual({
      ok: false,
      error:
        'Invalid payload for “controller.create”: payload.name: Invalid input: expected string, received number; payload: Unrecognized key: "limitPixelRatio"',
      issues: [
        "payload.name: Invalid input: expected string, received number",
        'payload: Unrecognized key: "limitPixelRatio"',
      ],
    });
    socket.receive({
      type: "request",
      requestId: "r2",
      name: "documents.save",
      payload: { path: 1 },
    });
    expect(socket.reply("r2").outcome).toEqual({
      ok: false,
      error:
        "Invalid payload for “documents.save”: payload.documentId: Invalid input: expected string, received undefined; payload.path: Invalid input: expected string, received number",
      issues: [
        "payload.documentId: Invalid input: expected string, received undefined",
        "payload.path: Invalid input: expected string, received number",
      ],
    });
    live.close();
  });
});
