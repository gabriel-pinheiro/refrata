import { describe, expect, it } from "vitest";

import { actionProblem } from "../address/fire.ts";
import { executeCommand } from "../command/execute.ts";
import {
  emptyDocument,
  type Document,
  type RunnableMacro,
} from "../document/document.ts";
import { orderedEntries } from "../document/order.ts";
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
    ["macro.create", { id: "hit", name: "Hit" }],
    ["macro.create", { id: "look", name: "Look" }],
  ] as const)
    document = run(document, name, payload).document;
  return document;
}

const macro = (document: Document, id: string): RunnableMacro =>
  document.macros[id] as RunnableMacro;
const actionsOf = (document: Document, id: string) =>
  macro(document, id).actions.map(({ kind, address }) => `${kind} ${address}`);

describe("Macros", () => {
  it("creates, groups, moves, duplicates, ungroups and removes Macros", () => {
    let document = stage();
    expect(macro(document, "hit")).toMatchObject({
      kind: "macro",
      actions: [],
    });
    expect(orderedEntries(document.macros).map((m) => m.id)).toEqual([
      "look",
      "hit",
    ]);
    document = run(document, "macro.create", {
      id: "g",
      kind: "group",
      name: "Hits",
    }).document;
    document = run(document, "macro.move", {
      macroId: "hit",
      parentId: "g",
      after: null,
    }).document;
    expect(document.macros.hit?.parentId).toBe("g");
    expect(
      failure(document, "macro.move", {
        macroId: "g",
        parentId: "g",
        after: null,
      }),
    ).toMatch(/into itself/);
    document = run(document, "macro.actions.add", {
      macroId: "hit",
      actions: [{ kind: "toggle", address: "installation/blackout" }],
    }).document;
    document = run(document, "macro.duplicate", {
      macroId: "g",
      id: "g2",
    }).document;
    const copied = orderedEntries(document.macros).filter(
      (m) => m.parentId === "g2",
    );
    expect(copied).toHaveLength(1);
    expect(copied[0]?.name).toBe("Hit");
    expect(macro(document, copied[0]?.id ?? "").actions[0]?.id).not.toBe(
      macro(document, "hit").actions[0]?.id,
    );
    document = run(document, "macro.ungroup", { macroId: "g2" }).document;
    expect(document.macros.g2).toBeUndefined();
    expect(document.macros[copied[0]?.id ?? ""]?.parentId).toBeNull();
    // Another Macro running the Group's Macro loses that action when the Group goes.
    document = run(document, "macro.actions.add", {
      macroId: "look",
      actions: [
        { kind: "trigger", address: "macro/hit/run" },
        { kind: "set", address: "installation/blackout", value: false },
      ],
    }).document;
    const removal = run(document, "macro.remove", { macroId: "g" });
    document = removal.document;
    expect(document.macros.hit).toBeUndefined();
    expect(actionsOf(document, "look")).toEqual(["set installation/blackout"]);
    expect(removal.warnings).toEqual([
      "Removed 1 Macro action targeting “Hits”",
    ]);
  });

  it("adds, edits, reorders and removes actions", () => {
    let document = stage();
    document = run(document, "macro.actions.add", {
      macroId: "look",
      actions: [
        { kind: "set", address: "controller/energy/value", value: 0.5 },
        { kind: "set", address: "controller/tint/value", value: [1, 0, 0, 1] },
        { kind: "trigger", address: "macro/hit/run" },
      ],
    }).document;
    const [energy, tint, hit] = macro(document, "look").actions;
    document = run(document, "macro.actions.add", {
      macroId: "look",
      actions: [{ kind: "toggle", address: "installation/blackout" }],
      after: null,
    }).document;
    expect(actionsOf(document, "look")).toEqual([
      "toggle installation/blackout",
      "set controller/energy/value",
      "set controller/tint/value",
      "trigger macro/hit/run",
    ]);
    document = run(document, "macro.action.move", {
      macroId: "look",
      actionId: hit?.id,
      after: null,
    }).document;
    document = run(document, "macro.action.update", {
      macroId: "look",
      actionId: tint?.id,
      value: [0, 1, 0, 1],
    }).document;
    document = run(document, "macro.action.update", {
      macroId: "look",
      actionId: macro(document, "look").actions[1]?.id,
      kind: "set",
      value: false,
    }).document;
    document = run(document, "macro.action.remove", {
      macroId: "look",
      actionId: energy?.id,
    }).document;
    expect(macro(document, "look").actions).toMatchObject([
      { kind: "trigger", address: "macro/hit/run" },
      { kind: "set", address: "installation/blackout", value: false },
      { kind: "set", address: "controller/tint/value", value: [0, 1, 0, 1] },
    ]);
    expect(
      failure(document, "macro.actions.add", {
        macroId: "look",
        actions: [{ kind: "set", address: "controller/zz/value", value: 1 }],
      }),
    ).toMatch(/Unknown address/);
    expect(
      failure(document, "macro.actions.add", {
        macroId: "look",
        actions: [{ kind: "toggle", address: "controller/energy/value" }],
      }),
    ).toMatch(/not a switch/);
    expect(
      failure(document, "macro.actions.add", {
        macroId: "look",
        actions: [
          { kind: "set", address: "controller/energy/value", value: "x" },
        ],
      }),
    ).toMatch(/value/);
    expect(
      failure(document, "macro.actions.add", {
        macroId: "look",
        actions: [{ kind: "set", address: "macro/hit/run", value: 1 }],
      }),
    ).toMatch(/trigger/);
  });

  it("runs actions in order, best-effort, through address.trigger", () => {
    let document = stage();
    document = run(document, "macro.actions.add", {
      macroId: "look",
      actions: [
        { kind: "set", address: "controller/energy/value", value: 0.25 },
        { kind: "toggle", address: "installation/blackout" },
        { kind: "toggle", address: "installation/blackout" },
        { kind: "set", address: "controller/tint/value", value: [0, 0, 1, 1] },
        { kind: "set", address: "controller/energy/value", value: 0.75 },
      ],
    }).document;
    expect(
      macro(document, "look").actions.map((action) =>
        actionProblem(document, action),
      ),
    ).toEqual([undefined, undefined, undefined, undefined, undefined]);
    const result = run(document, "address.trigger", {
      address: "macro/look/run",
    });
    expect(result.definition.kind).toBe("performance");
    expect(result.events).toEqual([]);
    expect(result.warnings).toEqual([]);
    document = result.document;
    expect(document.operational.blackout).toBe(false);
    expect(document.controllers.energy).toMatchObject({ value: 0.75 });
    expect(document.controllers.tint).toMatchObject({ value: [0, 0, 1, 1] });
    expect(
      failure(document, "address.trigger", { address: "macro/nope/run" }),
    ).toMatch(/Unknown address/);
    expect(
      failure(document, "address.trigger", {
        address: "controller/energy/value",
      }),
    ).toMatch(/not a trigger/);
  });

  it("skips an action whose target went away and reports it", () => {
    let document = stage();
    document = run(document, "macro.actions.add", {
      macroId: "look",
      actions: [
        { kind: "set", address: "controller/energy/value", value: 1 },
        { kind: "set", address: "installation/blackout", value: true },
      ],
    }).document;
    // A target removed behind the Macro's back: the action is dropped with
    // the Controller, so what remains runs clean.
    const gone = run(document, "controller.remove", {
      controllerId: "energy",
    }).document;
    expect(actionsOf(gone, "look")).toEqual(["set installation/blackout"]);
    const result = run(gone, "address.trigger", { address: "macro/look/run" });
    expect(result.warnings).toEqual([]);
    expect(result.document.operational.blackout).toBe(true);
  });

  it("lets Macros run Macros, each at most once per run", () => {
    let document = stage();
    document = run(document, "macro.create", {
      id: "all",
      name: "All",
    }).document;
    document = run(document, "macro.actions.add", {
      macroId: "hit",
      actions: [
        { kind: "set", address: "controller/energy/value", value: 0.5 },
        { kind: "trigger", address: "macro/look/run" },
      ],
    }).document;
    document = run(document, "macro.actions.add", {
      macroId: "look",
      actions: [
        { kind: "toggle", address: "installation/blackout" },
        { kind: "trigger", address: "macro/hit/run" },
      ],
    }).document;
    document = run(document, "macro.actions.add", {
      macroId: "all",
      actions: [
        { kind: "trigger", address: "macro/hit/run" },
        { kind: "trigger", address: "macro/look/run" },
      ],
    }).document;
    const result = run(document, "address.trigger", {
      address: "macro/all/run",
    });
    expect(result.document.controllers.energy).toMatchObject({ value: 0.5 });
    expect(result.document.operational.blackout).toBe(true);
    expect(result.warnings).toEqual([
      "Hit: already ran during this run.",
      "Look: already ran during this run.",
    ]);
  });

  it("drops actions with the Controller or Macro they target", () => {
    let document = stage();
    document = run(document, "macro.actions.add", {
      macroId: "look",
      actions: [
        { kind: "set", address: "controller/energy/value", value: 1 },
        { kind: "trigger", address: "macro/hit/run" },
        { kind: "set", address: "installation/blackout", value: true },
      ],
    }).document;
    const controllerGone = run(document, "controller.remove", {
      controllerId: "energy",
    });
    expect(controllerGone.warnings).toEqual([
      "Removed 1 Macro action targeting “Energy”",
    ]);
    const macroGone = run(controllerGone.document, "macro.remove", {
      macroId: "hit",
    });
    expect(macroGone.warnings).toEqual([
      "Removed 1 Macro action targeting “Hit”",
    ]);
    expect(actionsOf(macroGone.document, "look")).toEqual([
      "set installation/blackout",
    ]);
    // A removal that drops nothing warns about nothing.
    const next = run(macroGone.document, "macro.create", {
      id: "empty",
      name: "Empty",
    }).document;
    expect(run(next, "macro.remove", { macroId: "empty" }).warnings).toEqual(
      [],
    );
  });
});

describe("macro.create placement", () => {
  it("lands first unless `after` names the sibling to follow, within its Group", () => {
    let document = emptyDocument("Living");
    for (const payload of [
      { id: "g", kind: "group", name: "Hits" },
      { id: "a", parentId: "g", name: "A" },
      { id: "b", parentId: "g", name: "B", after: "a" },
      { id: "c", parentId: "g", name: "C", after: "a" },
    ] as const)
      document = run(document, "macro.create", payload).document;
    expect(
      orderedEntries(document.macros)
        .filter((macro) => macro.parentId === "g")
        .map((macro) => macro.id),
    ).toEqual(["a", "c", "b"]);
    const result = executeCommand(registry, document, "macro.create", {
      parentId: "g",
      after: "g",
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toBe("Macro “g” is not among the siblings.");
  });
});
