import { describe, expect, it } from "vitest";

import { executeCommand } from "../command/execute.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { orderedEntries } from "../document/order.ts";
import { applyPatches } from "../document/patch.ts";
import { createBuiltInRegistry } from "./index.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown) {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("built-in commands", () => {
  it("renames the Installation as one coalesced, undoable step", () => {
    const start = emptyDocument("Living");
    const renamed = run(start, "installation.rename", { name: "Club" });
    expect(renamed.document.installation.name).toBe("Club");
    expect(renamed.label).toBe("Rename Installation");
    expect(renamed.coalesceKey).toBe("installation.rename");
    expect(applyPatches(renamed.document, renamed.inverse)).toEqual(start);
    expect(
      run(renamed.document, "installation.rename", { name: "Club" }).patches,
    ).toEqual([]);
  });

  it("moves entities among their siblings with one order patch", () => {
    let document = emptyDocument("Living");
    for (const name of ["A", "B", "C"]) {
      document = run(document, "controller.create", {
        id: `c_${name}`,
        kind: "number",
        name,
        after: name === "A" ? null : `c_${name === "B" ? "A" : "B"}`,
      }).document;
    }
    const names = (candidate: Document) =>
      orderedEntries(candidate.controllers).map((c) => c.name);
    expect(names(document)).toEqual(["A", "B", "C"]);

    const moved = run(document, "entity.move", {
      table: "controllers",
      id: "c_C",
      after: null,
    });
    expect(moved.patches).toHaveLength(1);
    expect(names(moved.document)).toEqual(["C", "A", "B"]);
    expect(moved.label).toBe("Move Controller");
    expect(applyPatches(moved.document, moved.inverse)).toEqual(document);

    const unchanged = run(moved.document, "entity.move", {
      table: "controllers",
      id: "c_A",
      after: "c_C",
    });
    expect(unchanged.patches).toEqual([]);
  });

  it("moves only among siblings of the same Group", () => {
    let document = emptyDocument("Living");
    document = run(document, "controller.create", {
      id: "g",
      kind: "group",
      name: "G",
    }).document;
    document = run(document, "controller.create", {
      id: "inside",
      kind: "number",
      name: "Inside",
      parentId: "g",
    }).document;
    document = run(document, "controller.create", {
      id: "outside",
      kind: "number",
      name: "Outside",
    }).document;
    const result = executeCommand(registry, document, "entity.move", {
      table: "controllers",
      id: "inside",
      after: "outside",
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toBe(
        "Controller “outside” is not a sibling of “inside”.",
      );
  });

  it("rejects unknown commands and invalid payloads with every issue named", () => {
    const document = emptyDocument("Living");
    expect(executeCommand(registry, document, "nope.do", {})).toMatchObject({
      ok: false,
      error: "Unknown command “nope.do”.",
    });
    const invalid = executeCommand(registry, document, "controller.create", {
      kind: "nope",
      name: "",
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.issues?.length).toBe(2);
  });
});
