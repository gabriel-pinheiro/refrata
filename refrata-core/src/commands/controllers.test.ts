import { describe, expect, it } from "vitest";

import { resolveAddress } from "../address/address.ts";
import { executeCommand } from "../command/execute.ts";
import {
  emptyDocument,
  tableEntries,
  type Document,
} from "../document/document.ts";
import { orderedEntries } from "../document/order.ts";
import { applyPatches } from "../document/patch.ts";
import { createBuiltInRegistry } from "./index.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown) {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result;
}

function failure(document: Document, name: string, payload: unknown): string {
  const result = executeCommand(registry, document, name, payload);
  if (result.ok) throw new Error("Expected a rejection.");
  return result.error;
}

function stage(): Document {
  let document = emptyDocument("Living");
  for (const [name, payload] of [
    ["controller.create", { id: "energy", kind: "number", name: "Energy" }],
    ["controller.create", { id: "tint", kind: "color", name: "Tint" }],
  ] as const)
    document = run(document, name, payload).document;
  return document;
}

describe("Controllers", () => {
  it("creates, groups, moves, duplicates and removes Controllers", () => {
    let document = stage();
    expect(document.controllers.energy).toMatchObject({
      kind: "number",
      value: 0,
      parentId: null,
    });
    expect(document.controllers.tint).toMatchObject({
      kind: "color",
      value: [1, 1, 1, 1],
    });
    // New Controllers land first.
    expect(orderedEntries(document.controllers).map((c) => c.id)).toEqual([
      "tint",
      "energy",
    ]);
    const created = run(document, "controller.create", {
      id: "g",
      kind: "group",
      name: "Colors",
    });
    expect(created.label).toBe("Add Group");
    document = created.document;
    document = run(document, "controller.move", {
      controllerId: "tint",
      parentId: "g",
      after: null,
    }).document;
    expect(document.controllers.tint?.parentId).toBe("g");
    expect(
      failure(document, "controller.move", {
        controllerId: "g",
        parentId: "g",
        after: null,
      }),
    ).toContain("into itself");
    const duplicated = run(document, "controller.duplicate", {
      controllerId: "g",
      id: "g2",
    }).document;
    const copies = tableEntries(duplicated.controllers).filter(
      (c) => c.parentId === "g2",
    );
    expect(copies.map((c) => c.name)).toEqual(["Tint"]);
    const ungrouped = run(document, "controller.ungroup", {
      controllerId: "g",
    }).document;
    expect(ungrouped.controllers.g).toBeUndefined();
    expect(ungrouped.controllers.tint?.parentId).toBeNull();
    const removal = run(document, "controller.remove", {
      controllerId: "g",
    });
    expect(removal.document.controllers.tint).toBeUndefined();
    expect(removal.document.controllers.energy).toBeDefined();
    expect(removal.warnings).toEqual([]);
    expect(applyPatches(removal.document, removal.inverse)).toEqual(document);
  });

  it("renames within siblings, numbering a taken name", () => {
    let document = stage();
    document = run(document, "controller.rename", {
      controllerId: "tint",
      name: "Energy",
    }).document;
    expect(document.controllers.tint?.name).toBe("Energy 1");
    const unchanged = run(document, "controller.rename", {
      controllerId: "energy",
      name: "Energy",
    });
    expect(unchanged.patches).toEqual([]);
  });

  it("writes a Controller's value through its Address", () => {
    const document = stage();
    const moved = run(document, "address.edit", {
      address: "controller/energy/value",
      value: 0.25,
    });
    expect(moved.document.controllers.energy).toMatchObject({ value: 0.25 });
    expect(moved.label).toBe("Change Value");
    expect(
      failure(document, "address.set", {
        address: "controller/energy/value",
        value: 2,
      }),
    ).toContain("between 0 and 1");
    expect(resolveAddress(document, "controller/tint/value")?.type).toBe(
      "color",
    );
    expect(
      resolveAddress(document, "controller/energy/value"),
    ).not.toHaveProperty("default");
  });

  it("drops Macro actions on a removed Controller and says so", () => {
    let document = stage();
    document = run(document, "macro.create", {
      id: "look",
      name: "Look",
    }).document;
    document = run(document, "macro.actions.add", {
      macroId: "look",
      actions: [
        { kind: "set", address: "controller/energy/value", value: 1 },
        { kind: "set", address: "installation/blackout", value: true },
      ],
    }).document;
    const removal = run(document, "controller.remove", {
      controllerId: "energy",
    });
    expect(removal.warnings).toEqual([
      "Removed 1 Macro action targeting “Energy”",
    ]);
    const look = removal.document.macros.look;
    expect(look?.kind === "macro" ? look.actions : []).toMatchObject([
      { address: "installation/blackout" },
    ]);
  });
});

describe("controller.create placement", () => {
  it("lands first unless `after` names the sibling to follow", () => {
    let document = emptyDocument("Living");
    for (const payload of [
      { id: "a", kind: "number", name: "A" },
      { id: "b", kind: "number", name: "B", after: "a" },
      { id: "c", kind: "number", name: "C", after: "a" },
      { id: "d", kind: "number", name: "D" },
    ] as const)
      document = run(document, "controller.create", payload).document;
    expect(orderedEntries(document.controllers).map((c) => c.id)).toEqual([
      "d",
      "a",
      "c",
      "b",
    ]);
    expect(
      failure(document, "controller.create", {
        kind: "number",
        after: "zz",
      }),
    ).toBe("Controller “zz” is not among the siblings.");
  });
});
