import {
  applyPatches,
  createBuiltInRegistry,
  emptyDocument,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import { DocumentSession, type DocumentDelta } from "./document-session.ts";

function session() {
  const doc = new DocumentSession(
    emptyDocument("Living"),
    createBuiltInRegistry(),
  );
  const deltas: DocumentDelta[] = [];
  doc.onDelta((delta) => deltas.push(delta));
  return { doc, deltas };
}

describe("DocumentSession", () => {
  it("executes commands, advances revision and emits one delta each", () => {
    const { doc, deltas } = session();
    const created = doc.execute(
      "controller.create",
      { id: "energy", kind: "number", name: "Energy" },
      "studio",
    );
    expect(created).toEqual({
      ok: true,
      revision: 1,
      changed: true,
      label: "Add Number Controller",
      created: [{ table: "controllers", id: "energy" }],
    });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({
      fromRevision: 0,
      revision: 1,
      originSessionId: "studio",
    });
    expect(doc.dirty).toBe(true);
    expect(doc.summary()).toMatchObject({ name: "Living", revision: 1 });
  });

  it("dirties only for saved state, and records history only for authoring", () => {
    const { doc } = session();
    const result = doc.execute(
      "address.set",
      { address: "installation/blackout", value: true },
      "osc",
    );
    expect(result.ok).toBe(true);
    expect(doc.dirty).toBe(false);
    expect(doc.document.operational.blackout).toBe(true);
    expect(doc.execute("history.undo", {}, "osc")).toEqual({
      ok: false,
      error: "Nothing to undo.",
    });
    // A Controller moved from a hub is saved with the file: dirty, still not undoable.
    doc.execute(
      "controller.create",
      { id: "energy", kind: "number", name: "Energy" },
      "studio",
    );
    doc.markSaved();
    expect(doc.dirty).toBe(false);
    expect(
      doc.execute(
        "address.set",
        { address: "controller/energy/value", value: 0.5 },
        "osc",
      ).ok,
    ).toBe(true);
    expect(doc.dirty).toBe(true);
    expect(doc.document.controllers.energy).toMatchObject({ value: 0.5 });
    expect(doc.execute("history.undo", {}, "osc")).toEqual({
      ok: false,
      error: "Nothing to undo.",
    });
  });

  it("undoes and redoes per session", () => {
    const { doc, deltas } = session();
    doc.execute(
      "controller.create",
      { id: "energy", kind: "number", name: "Energy" },
      "studio",
    );
    doc.execute(
      "controller.rename",
      { controllerId: "energy", name: "Drive" },
      "cli",
    );

    expect(doc.execute("history.undo", {}, "studio").ok).toBe(false); // cli renamed it after
    const cliUndo = doc.execute("history.undo", {}, "cli");
    expect(cliUndo).toMatchObject({ ok: true, label: "Rename Controller" });
    expect(doc.document.controllers.energy?.name).toBe("Energy");

    const studioUndo = doc.execute("history.undo", {}, "studio");
    expect(studioUndo.ok).toBe(true);
    expect(doc.document.controllers).toEqual({});
    expect(deltas.at(-1)?.patches).toEqual([
      { op: "remove", path: ["controllers", "energy"] },
    ]);

    expect(doc.execute("history.redo", {}, "studio").ok).toBe(true);
    expect(doc.document.controllers.energy?.name).toBe("Energy");
  });

  it("replaceDocument sets every table, so a replica catches up in one delta", () => {
    const { doc, deltas } = session();
    doc.execute(
      "controller.create",
      { id: "energy", kind: "number", name: "Energy" },
      "studio",
    );
    doc.execute("macro.create", { id: "hit", name: "Hit" }, "studio");
    doc.execute(
      "address.set",
      { address: "installation/blackout", value: true },
      "osc",
    );
    const replica = doc.document;

    const other = new DocumentSession(
      { ...emptyDocument("Living"), installation: replica.installation },
      createBuiltInRegistry(),
    );
    other.execute(
      "controller.create",
      { id: "tint", kind: "color", name: "Tint" },
      "studio",
    );
    other.execute("macro.create", { id: "look", name: "Look" }, "studio");
    const next = other.document;

    doc.replaceDocument(next, "runtime");
    const delta = deltas.at(-1)!;
    expect(delta.patches.map((patch) => patch.path)).toEqual(
      Object.keys(next)
        .filter((table) => table !== "operational")
        .map((table) => [table]),
    );
    const caughtUp = applyPatches(replica, delta.patches);
    expect(caughtUp).toEqual({ ...next, operational: replica.operational });
    expect(caughtUp.operational.blackout).toBe(true);
    expect(doc.document).toEqual(caughtUp);
    expect(doc.dirty).toBe(false);
  });

  it("reports every entity a command adds, whatever the command", () => {
    const { doc } = session();
    doc.execute(
      "controller.create",
      { id: "g", kind: "group", name: "Looks" },
      "studio",
    );
    doc.execute(
      "controller.create",
      { id: "tint", kind: "color", name: "Tint", parentId: "g" },
      "studio",
    );
    const duplicated = doc.execute(
      "controller.duplicate",
      { controllerId: "g", id: "g2" },
      "studio",
    );
    expect(duplicated.ok && duplicated.created).toEqual([
      { table: "controllers", id: "g2" },
      {
        table: "controllers",
        id: expect.stringMatching(/^controller_/) as string,
      },
    ]);
    // A change to an existing entity creates nothing, and says so by omission.
    const renamed = doc.execute(
      "controller.rename",
      { controllerId: "g", name: "Colors" },
      "studio",
    );
    expect(renamed.ok && "created" in renamed).toBe(false);
  });

  it("lists every payload problem, not only the first", () => {
    const { doc } = session();
    expect(doc.execute("controller.create", { kind: "nope" }, "x")).toEqual({
      ok: false,
      error:
        'Invalid payload for “controller.create”: payload.kind: Invalid option: expected one of "number"|"color"|"group"',
      issues: [
        'payload.kind: Invalid option: expected one of "number"|"color"|"group"',
      ],
    });
    expect(
      doc.execute("macro.actions.add", { macroId: 1, actions: "x" }, "x"),
    ).toMatchObject({
      ok: false,
      issues: [
        "payload.macroId: Invalid input: expected string, received number",
        "payload.actions: Invalid input: expected array, received string",
      ],
    });
  });

  it("reports unknown commands", () => {
    const { doc } = session();
    expect(doc.execute("nope.nothing", {}, "x")).toEqual({
      ok: false,
      error: "Unknown command “nope.nothing”.",
    });
  });
});
