import { createBuiltInRegistry, emptyDocument, settings } from "@refrata/core";
import Fastify, { type FastifyInstance } from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { serializeDocument } from "./document-file.ts";
import { downloadFileName, registerDocumentRoutes } from "./document-routes.ts";
import { DocumentStore } from "./document-store.ts";

const url = settings.runtime.documentPath;
let dir: string;
let store: DocumentStore;
let app: FastifyInstance;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "refrata-"));
  store = new DocumentStore({ registry: createBuiltInRegistry() });
  app = Fastify();
  registerDocumentRoutes(app, store);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  // Some tests leave a dirty document with a path: let its sidecar land before the folder goes.
  await store.flush();
  await rm(dir, { recursive: true, force: true });
});

describe("GET /document", () => {
  it("is 404 with nothing open", async () => {
    const response = await app.inject({ method: "GET", url });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "No Installation is open." });
  });

  it("downloads what Save would write now, unsaved changes included, leaving the document as it was", async () => {
    const created = await store.create("Sala / Térreo");
    const session = store.session(created.ok ? created.result.id : "")!;
    const response = await app.inject({ method: "GET", url });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(serializeDocument(session.document));
    expect(response.headers["content-disposition"]).toBe(
      `attachment; filename="Sala - T_rreo.refrata"; filename*=UTF-8''Sala%20-%20T%C3%A9rreo.refrata`,
    );

    await store.save(session.id, path.join(dir, "show"));
    session.execute(
      "controller.create",
      { id: "energy", kind: "number", name: "Energy" },
      "test",
    );
    const dirty = await app.inject({ method: "GET", url });
    expect(dirty.body).toContain("energy");
    expect(dirty.headers["content-disposition"]).toContain(
      'filename="show.refrata"',
    );
    expect(store.current()).toMatchObject({ dirty: true, revision: 1 });
  });

  it("names a pathless copy after the Installation, whatever its name", () => {
    expect(downloadFileName({ name: "Living", path: null })).toBe(
      "Living.refrata",
    );
    expect(downloadFileName({ name: "../..", path: null })).toBe(
      "Installation.refrata",
    );
    expect(downloadFileName({ name: "x", path: "/shows/a.refrata" })).toBe(
      "a.refrata",
    );
  });
});

describe("PUT /document", () => {
  it("replaces the content whatever the content type, and answers the summary", async () => {
    const created = await store.create("Show");
    const session = store.session(created.ok ? created.result.id : "")!;
    await store.save(session.id, path.join(dir, "show"));
    const copy = {
      ...session.document,
      installation: { ...session.document.installation, name: "Restored" },
    };
    for (const contentType of [
      "application/json",
      "application/octet-stream",
      "text/plain",
    ]) {
      const response = await app.inject({
        method: "PUT",
        url: `${url}?discard=true`,
        headers: { "content-type": contentType },
        payload: serializeDocument(copy),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        id: session.id,
        name: "Restored",
        path: path.join(dir, "show.refrata"),
        dirty: true,
      });
    }
  });

  it("is 409 over unsaved changes until discard=true", async () => {
    const created = await store.create("Show");
    const session = store.session(created.ok ? created.result.id : "")!;
    session.execute(
      "controller.create",
      { id: "energy", kind: "number", name: "Energy" },
      "test",
    );
    const payload = serializeDocument(emptyDocument("Other"));
    const refused = await app.inject({ method: "PUT", url, payload });
    expect(refused.statusCode).toBe(409);
    expect(refused.json<{ error: string }>().error).toContain(
      "unsaved changes",
    );
    const accepted = await app.inject({
      method: "PUT",
      url: `${url}?discard=true`,
      payload,
    });
    expect(accepted.statusCode).toBe(200);
    expect(store.current()?.name).toBe("Other");
  });

  it("says why a body is not acceptable", async () => {
    const empty = await app.inject({ method: "PUT", url });
    expect(empty.statusCode).toBe(400);
    const invalid = await app.inject({ method: "PUT", url, payload: "{}" });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json<{ error: string }>().error).toContain(
      "Not a Refrata Installation file",
    );
    const query = await app.inject({
      method: "PUT",
      url: `${url}?force=1`,
      payload: "{}",
    });
    expect(query.statusCode).toBe(400);
    expect(store.current()).toBeNull();
  });

  it("is 413 past the size limit", async () => {
    const response = await app.inject({
      method: "PUT",
      url,
      payload: " ".repeat(settings.runtime.maxDocumentBytes + 1),
    });
    expect(response.statusCode).toBe(413);
    expect(response.json<{ error: string }>().error).toContain("64 MiB");
  });
});
