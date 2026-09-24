import { describe, expect, it } from "vitest";

import { actionProblem } from "../address/fire.ts";
import { executeCommand } from "../command/execute.ts";
import { seededRandom } from "../command/random.ts";
import {
  emptyDocument,
  type Document,
  type RunnableMacro,
} from "../document/document.ts";
import { orderedEntries } from "../document/order.ts";
import { createBuiltInRegistry } from "./index.ts";

const registry = createBuiltInRegistry();

function run(
  document: Document,
  name: string,
  payload: unknown,
  random: () => number = Math.random,
) {
  const result = executeCommand(registry, document, name, payload, random);
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
  it("creates a Macro with its actions in one command, and refuses them on a Group", () => {
    let document = stage();
    document = run(document, "macro.create", {
      id: "again",
      name: "Again",
      actions: [{ kind: "trigger", address: "macro/hit/run" }],
    }).document;
    expect(actionsOf(document, "again")).toEqual(["trigger macro/hit/run"]);
    expect(
      failure(document, "macro.create", {
        name: "Nowhere",
        actions: [{ kind: "trigger", address: "scene/gone/play" }],
      }),
    ).toMatch(/Unknown address/);
    expect(
      failure(document, "macro.create", {
        kind: "group",
        actions: [{ kind: "trigger", address: "macro/hit/run" }],
      }),
    ).toMatch(/holds no actions/);
  });

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

describe("Chance and Run Mode commands", () => {
  it("stores each action's Chance and changes it alone, triggers included", () => {
    let document = stage();
    document = run(document, "macro.actions.add", {
      macroId: "look",
      actions: [
        {
          kind: "set",
          address: "controller/energy/value",
          value: 0.5,
          chance: 0.4,
        },
        { kind: "trigger", address: "macro/hit/run" },
      ],
    }).document;
    const [energy, hit] = macro(document, "look").actions;
    expect(energy?.chance).toBe(0.4);
    expect(hit?.chance).toBeUndefined();
    const changed = run(document, "macro.action.update", {
      macroId: "look",
      actionId: hit?.id,
      chance: 0.2,
    });
    expect(changed.label).toBe("Change Chance");
    expect(changed.coalesceKey).toBe(
      `macro.action.update:${hit?.id ?? ""}:chance`,
    );
    document = changed.document;
    expect(macro(document, "look").actions[1]).toMatchObject({
      kind: "trigger",
      chance: 0.2,
    });
    document = run(document, "macro.action.update", {
      macroId: "look",
      actionId: energy?.id,
      value: 0.75,
    }).document;
    expect(macro(document, "look").actions[0]).toMatchObject({
      value: 0.75,
      chance: 0.4,
    });
    document = run(document, "macro.action.update", {
      macroId: "look",
      actionId: energy?.id,
      chance: null,
    }).document;
    expect(macro(document, "look").actions[0]?.chance).toBeUndefined();
    expect(
      failure(document, "macro.action.update", {
        macroId: "look",
        actionId: hit?.id,
        value: 1,
      }),
    ).toMatch(/only its chance/);
    expect(
      failure(document, "macro.actions.add", {
        macroId: "look",
        actions: [{ kind: "trigger", address: "macro/hit/run", chance: 2 }],
      }),
    ).toMatch(/chance/);
    // macro.create takes its actions with their Chance too.
    document = run(document, "macro.create", {
      id: "born",
      actions: [{ kind: "trigger", address: "macro/hit/run", chance: 0.1 }],
    }).document;
    expect(macro(document, "born")).toMatchObject({
      mode: "all",
      count: 1,
      actions: [{ chance: 0.1 }],
    });
  });

  it("sets the Run Mode and keeps the count across modes", () => {
    let document = stage();
    expect(macro(document, "hit")).toMatchObject({ mode: "all", count: 1 });
    const set = run(document, "macro.mode.set", {
      macroId: "hit",
      mode: "some",
      count: 3,
    });
    expect(set.label).toBe("Change Run Mode");
    document = set.document;
    expect(macro(document, "hit")).toMatchObject({ mode: "some", count: 3 });
    document = run(document, "macro.mode.set", {
      macroId: "hit",
      mode: "sequence",
    }).document;
    expect(macro(document, "hit")).toMatchObject({
      mode: "sequence",
      count: 3,
    });
    expect(run(document, "macro.mode.set", { macroId: "hit" }).patches).toEqual(
      [],
    );
    expect(
      failure(document, "macro.mode.set", { macroId: "hit", count: 0 }),
    ).toMatch(/count/);
    expect(
      failure(document, "macro.mode.set", { macroId: "nope", mode: "one" }),
    ).toMatch(/not a Macro/);
    const copy = run(document, "macro.duplicate", {
      macroId: "hit",
      id: "hit2",
    }).document;
    expect(macro(copy, "hit2")).toMatchObject({ mode: "sequence", count: 3 });
  });
});

describe("Run Modes", () => {
  /**
   * A Macro of four actions, each visible on its own: a Blackout toggle, an
   * Energy set, a Tint set and a Depth set.
   */
  function shimmer(mode: string, count = 1, chance?: number): Document {
    let document = stage();
    document = run(document, "controller.create", {
      id: "depth",
      kind: "number",
      name: "Depth",
    }).document;
    const roll = chance === undefined ? {} : { chance };
    document = run(document, "macro.actions.add", {
      macroId: "hit",
      actions: [
        { kind: "toggle", address: "installation/blackout", ...roll },
        {
          kind: "set",
          address: "controller/energy/value",
          value: 0.5,
          ...roll,
        },
        {
          kind: "set",
          address: "controller/tint/value",
          value: [1, 0, 0, 1],
          ...roll,
        },
        { kind: "set", address: "controller/depth/value", value: 0.5, ...roll },
      ],
    }).document;
    return run(document, "macro.mode.set", { macroId: "hit", mode, count })
      .document;
  }

  /** Which of the four actions a run performed, by index, against the document it ran on. */
  function performed(
    before: Document,
    result: ReturnType<typeof run>,
  ): number[] {
    const after = result.document;
    const done: number[] = [];
    if (after.operational.blackout !== before.operational.blackout)
      done.push(0);
    if (after.controllers.energy !== before.controllers.energy) done.push(1);
    if (after.controllers.tint !== before.controllers.tint) done.push(2);
    if (after.controllers.depth !== before.controllers.depth) done.push(3);
    return done;
  }

  const fire = (document: Document, random?: () => number) =>
    run(document, "address.trigger", { address: "macro/hit/run" }, random);

  it("runs every action in All", () => {
    const document = shimmer("all");
    const result = fire(document);
    expect(performed(document, result)).toEqual([0, 1, 2, 3]);
    expect(result.run).toEqual({ picked: 4, fired: 4 });
  });

  it("picks one action at random in One", () => {
    const document = shimmer("one");
    const seen = new Set<number>();
    for (let seed = 1; seed <= 12; seed += 1) {
      const result = fire(document, seededRandom(seed));
      const done = performed(document, result);
      expect(done).toHaveLength(1);
      expect(result.run).toEqual({ picked: 1, fired: 1 });
      seen.add(done[0] ?? -1);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("picks distinct actions in Some and runs them in list order", () => {
    const document = shimmer("some", 2);
    for (let seed = 1; seed <= 12; seed += 1) {
      const result = fire(document, seededRandom(seed));
      expect(performed(document, result)).toHaveLength(2);
      expect(result.run).toEqual({ picked: 2, fired: 2 });
    }
    // Two sets of the same Address land in list order whichever was drawn first.
    let ordered = shimmer("some", 9);
    ordered = run(ordered, "macro.actions.add", {
      macroId: "hit",
      actions: [
        { kind: "set", address: "controller/energy/value", value: 0.75 },
      ],
    }).document;
    const result = fire(ordered, seededRandom(7));
    expect(result.document.controllers.energy).toMatchObject({ value: 0.75 });
    expect(performed(ordered, result)).toEqual([0, 1, 2, 3]);
    expect(result.run).toEqual({ picked: 5, fired: 5 });
  });

  it("walks the actions in Sequence, wraps, and survives edits to the list", () => {
    let document = shimmer("sequence");
    let result = fire(document);
    expect(performed(document, result)).toEqual([0]);
    expect(result.run).toEqual({ picked: 1, fired: 1 });
    expect(result.document.operational.sequence.hit).toBe(1);
    expect(result.document.operational.blackout).toBe(true);
    // Only show state moved: nothing the file holds.
    expect(
      result.patches.every((patch) => patch.path[0] === "operational"),
    ).toBe(true);
    document = result.document;
    result = fire(document);
    expect(performed(document, result)).toEqual([1]);
    document = result.document;
    result = fire(document);
    expect(performed(document, result)).toEqual([2]);
    document = result.document;
    result = fire(document);
    expect(performed(document, result)).toEqual([3]);
    expect(result.document.operational.sequence.hit).toBe(0);
    document = result.document;
    // Wrapped: the toggle runs again and Blackout comes off.
    result = fire(document);
    expect(performed(document, result)).toEqual([0]);
    expect(result.document.operational.blackout).toBe(false);
    document = result.document;
    // Position 1 with the list cut to one action lands on that action.
    for (const action of macro(document, "hit").actions.slice(1))
      document = run(document, "macro.action.remove", {
        macroId: "hit",
        actionId: action.id,
      }).document;
    result = fire(document);
    expect(performed(document, result)).toEqual([0]);
    expect(result.document.operational.sequence.hit).toBe(0);
  });

  it("rolls each picked action's Chance, silently, and still advances a Sequence", () => {
    const never = shimmer("all", 1, 0);
    const none = fire(never);
    expect(performed(never, none)).toEqual([]);
    expect(none.warnings).toEqual([]);
    expect(none.run).toEqual({ picked: 4, fired: 0 });
    const always = shimmer("all", 1, 1);
    expect(performed(always, fire(always))).toEqual([0, 1, 2, 3]);
    const half = shimmer("all", 1, 0.5);
    const seeded = fire(half, seededRandom(3));
    expect(seeded.run?.picked).toBe(4);
    expect(performed(half, seeded)).toHaveLength(seeded.run?.fired ?? -1);
    expect(seeded.run?.fired).toBeGreaterThan(0);
    expect(seeded.run?.fired).toBeLessThan(4);
    const stepped = fire(shimmer("sequence", 1, 0));
    expect(stepped.document.operational.blackout).toBe(false);
    expect(stepped.run).toEqual({ picked: 1, fired: 0 });
    expect(stepped.document.operational.sequence.hit).toBe(1);
  });

  it("runs a nested Macro once whatever its mode, and an empty one picks nothing", () => {
    let document = shimmer("one");
    document = run(document, "macro.actions.add", {
      macroId: "look",
      actions: [
        { kind: "trigger", address: "macro/hit/run" },
        { kind: "trigger", address: "macro/hit/run" },
      ],
    }).document;
    const result = run(document, "address.trigger", {
      address: "macro/look/run",
    });
    expect(result.run).toEqual({ picked: 2, fired: 2 });
    expect(result.warnings).toEqual(["Hit: already ran during this run."]);
    expect(performed(document, result)).toHaveLength(1);
    const empty = run(
      run(document, "macro.create", { id: "e" }).document,
      "address.trigger",
      { address: "macro/e/run" },
    );
    expect(empty.run).toEqual({ picked: 0, fired: 0 });
    expect(empty.patches).toEqual([]);
  });
});
