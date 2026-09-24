import { RefrataClient } from "@refrata/client";
import type { FixtureType } from "@refrata/core";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import { buildRuntime, type Runtime } from "../server.ts";

let dir: string;
let runtime: Runtime;
let url: string;
const rgbType = rgbJson as unknown as FixtureType;

async function waitFor(done: () => boolean, timeoutMs = 2_000): Promise<void> {
  const started = Date.now();
  while (!done()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "refrata-swap-"));
  runtime = await buildRuntime({
    host: "127.0.0.1",
    port: 0,
    documents: "free",
    openPath: undefined,
    studioDist: undefined,
    libraryDir: path.join(dir, "no-library"),
    autosaveIntervalMs: 60_000,
    oscPort: undefined,
    discovery: false,
  });
  const address = await runtime.listen();
  url = `${address.replace("http", "ws")}/live`;
});

afterEach(async () => {
  await runtime.close();
  await rm(dir, { recursive: true, force: true });
});

/**
 * Writes `a.refrata` and its Save As copy `b.refrata`: one Installation id,
 * the Controller named apart, and the Fixture "spot" only in the first.
 */
async function writeCopies(): Promise<{ a: string; b: string; id: string }> {
  const { store } = runtime;
  const a = path.join(dir, "a.refrata");
  const b = path.join(dir, "b.refrata");
  const created = await store.create("Club", { blank: true });
  if (!created.ok) throw new Error(created.error);
  const { id } = created.result;
  const session = store.session(id);
  if (session === undefined) throw new Error("no session");
  for (const [name, payload] of [
    ["controller.create", { id: "energy", kind: "number", name: "A side" }],
    ...["par", "spot"].map(
      (fixtureId) =>
        [
          "fixture.create",
          {
            id: fixtureId,
            typeKey: "generic/rgb-3ch",
            modeKey: "3ch",
            fixtureType: rgbType,
          },
        ] as const,
    ),
  ] as const) {
    const result = session.execute(name, payload, "test");
    if (!result.ok) throw new Error(result.error);
  }
  await store.save(id, a);
  session.execute(
    "controller.rename",
    { controllerId: "energy", name: "B side" },
    "test",
  );
  session.execute("fixture.remove", { fixtureId: "spot" }, "test");
  await store.save(id, b);
  return { a, b, id };
}

describe("a session replaced by another with the same Installation id", () => {
  it("gives subscribers the new session's state and its deltas", async () => {
    const { a, b, id } = await writeCopies();
    const opened = await runtime.store.open(a);
    expect(opened.ok && opened.result.id).toBe(id);

    const studio = new RefrataClient({ url, kind: "studio", reconnect: false });
    await waitFor(() => studio.document.get()?.path === a);
    const view = studio.openDocument(id, { live: true });
    await waitFor(() => view.get() !== undefined);
    expect(view.get()?.controllers.energy?.name).toBe("A side");
    // Both files load at revision 0, so the revision cannot tell them apart.
    expect(view.revision.get()).toBe(0);

    await studio.request("documents.open", { path: b });
    await waitFor(() => view.get()?.controllers.energy?.name === "B side");
    // Same id: the view survives the swap instead of being dropped.
    expect(studio.view(id)).toBe(view);
    expect(studio.document.get()?.path).toBe(b);

    await studio.command(id, "controller.create", {
      id: "tint",
      kind: "color",
      name: "Tint",
    });
    expect(view.get()?.controllers.tint?.name).toBe("Tint");
    expect(view.get()?.controllers.energy?.name).toBe("B side");
    const session = runtime.store.currentSession();
    expect(view.get()).toEqual(session?.document);
    expect(view.revision.get()).toBe(session?.revision);

    // A change that does not come from this client reaches it too.
    session?.execute(
      "controller.rename",
      { controllerId: "tint", name: "Wash" },
      "test",
    );
    await waitFor(() => view.get()?.controllers.tint?.name === "Wash");
    studio.close();
  });

  it("carries a Resolved Stream over with a full message of the new session's values", async () => {
    const { a, b, id } = await writeCopies();
    await runtime.store.open(a);

    const studio = new RefrataClient({ url, kind: "studio", reconnect: false });
    await waitFor(() => studio.document.get()?.path === a);
    const view = studio.openDocument(id);
    await waitFor(() => view.get() !== undefined);
    studio.stream(id, ["par", "spot"]);
    await waitFor(() => view.resolvedAt("spot/root") !== undefined);
    expect(view.resolvedAt("par/root")).toBeDefined();

    // The view lives on, so the client does not ask for its stream again;
    // only a full message takes away the Fixture the copy does not have.
    await studio.request("documents.open", { path: b });
    await waitFor(() => view.resolvedAt("spot/root") === undefined);
    expect(view.resolvedAt("par/root")).toBeDefined();

    studio.input(id, "element/par/root/highlight", true);
    await waitFor(() => view.resolvedAt("par/root")?.dimmer === 1);
    studio.close();
  });
});
