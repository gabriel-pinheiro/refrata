import { createBuiltInRegistry } from "@refrata/core";
import { createSocket } from "node:dgram";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DocumentStore } from "../documents/document-store.ts";
import { decodePacket, encodeMessage } from "./osc-codec.ts";
import { OscServer } from "./osc-server.ts";
import { buildTree, leavesOf, targetOf } from "./osc-tree.ts";

let dir: string;
let store: DocumentStore;
let server: OscServer;
let port: number;
const logged: string[] = [];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "refrata-osc-"));
  store = new DocumentStore({
    projectsDir: dir,
    registry: createBuiltInRegistry(),
    autosaveIntervalMs: 60_000,
    log: () => undefined,
  });
  await store.create("Living");
  const session = store.currentSession();
  if (session === undefined) throw new Error("no session");
  for (const [name, payload] of [
    ["controller.create", { id: "energy", kind: "number", name: "Energy" }],
    ["controller.create", { id: "g", kind: "group", name: "Looks" }],
    [
      "controller.create",
      { id: "tint", kind: "color", name: "Tint", parentId: "g" },
    ],
    ["macro.create", { id: "hit", name: "Hit" }],
    [
      "macro.actions.add",
      {
        macroId: "hit",
        actions: [
          { kind: "set", address: "controller/energy/value", value: 0.75 },
        ],
      },
    ],
  ] as const) {
    const result = session.execute(name, payload, "test");
    if (!result.ok) throw new Error(result.error);
  }
  port = 19_000 + Math.floor(Math.random() * 20_000);
  logged.length = 0;
  server = new OscServer({
    store,
    port,
    host: "127.0.0.1",
    advertise: false,
    log: (line) => logged.push(line),
  });
  await server.start();
});

afterEach(async () => {
  await server.close();
  await rm(dir, { recursive: true, force: true });
});

const send = (bytes: Uint8Array): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = createSocket("udp4");
    socket.send(bytes, port, "127.0.0.1", (error) => {
      socket.close();
      if (error) reject(error);
      else resolve();
    });
  });

const get = async (path: string): Promise<unknown> =>
  (await fetch(`http://127.0.0.1:${String(port)}${path}`)).json();

describe("OSC tree", () => {
  it("has one leaf per Controller and Macro, named with its Group, and parses addresses", () => {
    const document = store.currentSession()?.document;
    expect(
      leavesOf(document).map((leaf) => [
        leaf.path,
        leaf.node.DESCRIPTION,
        leaf.node.TYPE,
      ]),
    ).toEqual([
      ["/controller/tint", "Looks · Tint", "r"],
      ["/controller/energy", "Energy", "f"],
      ["/macro/hit", "Hit", "I"],
      ["/installation/master", "Master", "f"],
    ]);
    const tree = buildTree(document);
    expect(tree.CONTENTS?.controller?.CONTENTS?.energy).toMatchObject({
      ACCESS: 3,
      RANGE: [{ MIN: 0, MAX: 1 }],
      VALUE: [0],
    });
    expect(targetOf("/controller/x")).toEqual({ kind: "controller", id: "x" });
    expect(targetOf("/controller/*")).toBeUndefined();
    expect(targetOf("/thing/x/opacity")).toEqual({
      kind: "address",
      address: "thing/x/opacity",
    });
    expect(targetOf("/thing")).toBeUndefined();
  });
});

describe("OSC composition leaves", () => {
  it("exposes Scene play, Master and Look Layer rows, and takes values for them", async () => {
    const session = store.currentSession();
    if (session === undefined) throw new Error("no session");
    for (const [name, payload] of [
      ["scene.create", { id: "verse", name: "Verse" }],
      ["scene.create", { id: "chorus", name: "Chorus" }],
      [
        "fixture.create",
        {
          id: "par",
          typeKey: "generic/rgb-3ch",
          modeKey: "3ch",
          name: "Par",
          fixtureType: {
            kind: "refrata-fixture-type",
            formatVersion: 1,
            key: "generic/rgb-3ch",
            manufacturer: "Generic",
            model: "RGB",
            modes: {
              "3ch": {
                name: "3ch",
                channels: [
                  { key: "r", element: "root" },
                  { key: "g", element: "root" },
                  { key: "b", element: "root" },
                ],
                elements: {
                  root: {
                    name: "RGB",
                    parameters: {
                      dimmer: { encode: { multiply: ["r", "g", "b"] } },
                      color: { encode: { color: ["r", "g", "b"] } },
                    },
                  },
                },
              },
            },
          },
        },
      ],
      [
        "layer.create",
        { id: "base", sceneId: "verse", name: "Base", targets: ["par/root"] },
      ],
      [
        "layer.row.set",
        {
          layerId: "base",
          targets: ["par/root"],
          attribute: "dimmer",
          value: 0.4,
        },
      ],
    ] as const) {
      const result = session.execute(name, payload, "test");
      if (!result.ok) throw new Error(result.error);
    }
    await wait(20);
    expect(await get("/scene/chorus/play")).toMatchObject({
      TYPE: "I",
      DESCRIPTION: "Chorus · Play",
    });
    expect(await get("/installation/master?VALUE")).toEqual({ VALUE: [1] });
    expect(await get("/layer/base/row/par/root/dimmer/value")).toMatchObject({
      TYPE: "f",
      VALUE: [0.4],
      RANGE: [{ MIN: 0, MAX: 1 }],
      DESCRIPTION: "Base · Par · Dimmer",
    });
    expect(await get("/layer/base/enabled")).toMatchObject({ TYPE: "T" });
    await send(encodeMessage({ address: "/scene/chorus/play", args: [] }));
    await send(
      encodeMessage({
        address: "/installation/master",
        args: [{ type: "float32", value: 0.5 }],
      }),
    );
    await send(
      encodeMessage({
        address: "/layer/base/row/par/root/dimmer/value",
        args: [{ type: "float32", value: 1.7 }],
      }),
    );
    await send(
      encodeMessage({
        address: "/layer/base/enabled",
        args: [{ type: "false" }],
      }),
    );
    await wait(60);
    expect(session.document.installation).toMatchObject({
      activeScene: "chorus",
      master: 0.5,
    });
    expect(session.document.layers.base).toMatchObject({
      enabled: false,
      rows: { "par/root": { dimmer: { value: 1 } } },
    });
    await send(
      encodeMessage({
        address: "/installation/blackout",
        args: [{ type: "true" }],
      }),
    );
    await wait(30);
    expect(logged.at(-1)).toBe("OSC unknown-address: /installation/blackout");
  });
});

describe("OSC server", () => {
  it("serves the tree, a node, an attribute and HOST_INFO over HTTP", async () => {
    expect(await get("/?HOST_INFO")).toMatchObject({
      NAME: "Refrata",
      OSC_PORT: port,
      WS_PORT: port,
      EXTENSIONS: { LISTEN: true, PATH_ADDED: true },
    });
    expect(await get("/")).toMatchObject({ DESCRIPTION: "Living" });
    expect(await get("/controller/energy?VALUE")).toEqual({ VALUE: [0] });
    expect(await get("/macro/hit")).toMatchObject({ TYPE: "I", ACCESS: 2 });
    expect((await fetch(`http://127.0.0.1:${String(port)}/nope`)).status).toBe(
      404,
    );
  });

  it("applies UDP messages as address commands, clamping and converting arguments", async () => {
    const document = () => store.currentSession()?.document;
    await send(
      encodeMessage({
        address: "/controller/energy",
        args: [{ type: "float32", value: 0.5 }],
      }),
    );
    await wait(50);
    expect(document()?.controllers.energy).toMatchObject({ value: 0.5 });
    // A fader sends any float; the value lands on the Controller's step grid.
    await send(
      encodeMessage({
        address: "/controller/energy",
        args: [{ type: "float32", value: 0.3731 }],
      }),
    );
    await wait(50);
    expect(document()?.controllers.energy).toMatchObject({ value: 0.37 });
    await send(
      encodeMessage({
        address: "/controller/energy",
        args: [{ type: "int32", value: 3 }],
      }),
    );
    await send(
      encodeMessage({
        address: "/controller/tint",
        args: [{ type: "color", value: [255, 0, 0, 255] }],
      }),
    );
    await wait(50);
    expect(document()?.controllers.energy).toMatchObject({ value: 1 });
    expect(document()?.controllers.tint).toMatchObject({ value: [1, 0, 0, 1] });
    await send(
      encodeMessage({
        address: "/controller/tint",
        args: [
          { type: "float32", value: 0 },
          { type: "float32", value: 0.5 },
          { type: "float32", value: 1 },
        ],
      }),
    );
    await send(encodeMessage({ address: "/macro/hit", args: [] }));
    await wait(50);
    expect(document()?.controllers.tint).toMatchObject({
      value: [0, 0.5, 1, 1],
    });
    expect(document()?.controllers.energy).toMatchObject({ value: 0.75 });
    await send(encodeMessage({ address: "/thing/x/opacity", args: [] }));
    await send(
      encodeMessage({
        address: "/controller/energy",
        args: [{ type: "string", value: "x" }],
      }),
    );
    await wait(50);
    expect(logged).toEqual([
      "OSC unknown-address: /thing/x/opacity",
      "OSC bad-arguments: /controller/energy: string",
    ]);
  });

  it("streams listened values and tree changes over the OSCQuery websocket, and takes OSC on it", async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${String(port)}`);
    const received: (string | { address: string; args: unknown[] })[] = [];
    socket.on("message", (raw, isBinary) => {
      const bytes = raw as Buffer;
      received.push(
        isBinary
          ? (decodePacket(new Uint8Array(bytes)) as {
              address: string;
              args: unknown[];
            })
          : bytes.toString(),
      );
    });
    await new Promise((resolve) => socket.once("open", resolve));
    expect(server.state()).toEqual({ port, listeners: 1 });
    socket.send(
      JSON.stringify({ COMMAND: "LISTEN", DATA: "/controller/energy" }),
    );
    await wait(30);
    const session = store.currentSession();
    if (session === undefined) throw new Error("no session");
    session.execute(
      "address.set",
      { address: "controller/energy/value", value: 0.25 },
      "studio",
    );
    session.execute(
      "address.set",
      { address: "controller/tint/value", value: [0, 0, 1, 1] },
      "studio",
    );
    session.execute(
      "controller.rename",
      { controllerId: "energy", name: "Power" },
      "studio",
    );
    session.execute(
      "controller.create",
      { id: "new", kind: "number", name: "New" },
      "studio",
    );
    session.execute("macro.remove", { macroId: "hit" }, "studio");
    await wait(60);
    expect(received).toEqual([
      '{"COMMAND":"PATH_REMOVED","DATA":"/macro/hit"}',
      '{"COMMAND":"PATH_ADDED","DATA":"/controller/new"}',
      '{"COMMAND":"PATH_CHANGED","DATA":"/controller/energy"}',
      {
        address: "/controller/energy",
        args: [{ type: "float32", value: 0.25 }],
      },
    ]);
    socket.send(
      encodeMessage({
        address: "/controller/energy",
        args: [{ type: "float32", value: 0.9 }],
      }),
      { binary: true },
    );
    await wait(50);
    expect(session.document.controllers.energy).toMatchObject({ value: 0.9 });
    socket.close();
    await wait(30);
    expect(server.state().listeners).toBe(0);
  });
});
