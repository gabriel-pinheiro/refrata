import { describe, expect, it } from "vitest";

import { executeCommand } from "../command/execute.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { createBuiltInRegistry } from "./index.ts";

const registry = createBuiltInRegistry();

function execute(document: Document, name: string, payload: unknown) {
  return executeCommand(registry, document, name, payload);
}

function run(document: Document, name: string, payload: unknown): Document {
  const result = execute(document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

function fails(document: Document, name: string, payload: unknown): string {
  const result = execute(document, name, payload);
  if (result.ok) throw new Error(`${name} was accepted.`);
  return result.error;
}

function stage(): Document {
  let document = emptyDocument("Living");
  document = run(document, "controller.create", {
    id: "energy",
    kind: "number",
    name: "Energy",
  });
  return run(document, "controller.create", {
    id: "tint",
    kind: "color",
    name: "Tint",
  });
}

describe("address.edit", () => {
  it("writes Controller values and Blackout, labelled by the property", () => {
    const document = stage();
    const value = execute(document, "address.edit", {
      address: "controller/energy/value",
      value: 0.4,
    });
    if (!value.ok) throw new Error(value.error);
    expect(value.document.controllers.energy).toMatchObject({ value: 0.4 });
    expect(value.label).toBe("Change Value");
    expect(value.coalesceKey).toBe("address.edit:controller/energy/value");
    expect(value.definition.kind).toBe("authoring");

    const tint = run(value.document, "address.edit", {
      address: "controller/tint/value",
      value: [1, 0, 0, 1],
    });
    expect(tint.controllers.tint).toMatchObject({ value: [1, 0, 0, 1] });

    const blackout = execute(tint, "address.set", {
      address: "installation/blackout",
      value: true,
    });
    if (!blackout.ok) throw new Error(blackout.error);
    expect(blackout.document.operational.blackout).toBe(true);
    expect(blackout.definition.kind).toBe("performance");
    const toggled = run(blackout.document, "address.toggle", {
      address: "installation/blackout",
    });
    expect(toggled.operational.blackout).toBe(false);
  });

  it("changes nothing when the value is already there, colors included", () => {
    const document = stage();
    const same = execute(document, "address.edit", {
      address: "controller/tint/value",
      value: [1, 1, 1, 1],
    });
    if (!same.ok) throw new Error(same.error);
    expect(same.patches).toEqual([]);
    const sameNumber = execute(document, "address.set", {
      address: "controller/energy/value",
      value: 0,
    });
    if (!sameNumber.ok) throw new Error(sameNumber.error);
    expect(sameNumber.patches).toEqual([]);
  });

  it("refuses unknown addresses, triggers and values the type does not accept", () => {
    let document = stage();
    expect(
      fails(document, "address.edit", {
        address: "controller/zz/value",
        value: 1,
      }),
    ).toBe("Unknown address “controller/zz/value”.");
    expect(
      fails(document, "address.edit", {
        address: "controller/energy/value",
        value: 9,
      }),
    ).toBe("Value must be between 0 and 1.");
    expect(
      fails(document, "address.set", {
        address: "controller/energy/value",
        value: "1",
      }),
    ).toBe("Value must be a number.");
    expect(
      fails(document, "address.toggle", { address: "controller/energy/value" }),
    ).toBe("Address “controller/energy/value” is not a boolean.");
    document = run(document, "macro.create", { id: "hit", name: "Hit" });
    expect(
      fails(document, "address.set", { address: "macro/hit/run", value: 1 }),
    ).toBe("Address “macro/hit/run” is a trigger; use address.trigger.");
  });

  it("holds a number to its step grid, absorbing float noise", () => {
    const document = stage();
    expect(
      fails(document, "address.edit", {
        address: "controller/energy/value",
        value: 0.373,
      }),
    ).toBe("Value must be a multiple of 0.01 from 0 (got 0.373).");
    const onGrid = run(document, "address.edit", {
      address: "controller/energy/value",
      value: 0.3,
    });
    expect(onGrid.controllers.energy).toMatchObject({ value: 0.3 });
    // 0.1 + 0.2 is 0.30000000000000004: a grid point with float noise.
    const noisy = run(document, "address.edit", {
      address: "controller/energy/value",
      value: 0.1 + 0.2,
    });
    expect(noisy.controllers.energy).toMatchObject({ value: 0.1 + 0.2 });
  });
});
