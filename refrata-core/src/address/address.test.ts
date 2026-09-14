import { describe, expect, it } from "vitest";

import { executeCommand } from "../command/execute.ts";
import { createBuiltInRegistry } from "../commands/index.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import {
  addressValueProblem,
  controllerAddress,
  linkable,
  listAddresses,
  resolveAddress,
  sameAddressValue,
} from "./address.ts";

const registry = createBuiltInRegistry();

function run(document: Document, name: string, payload: unknown): Document {
  const result = executeCommand(registry, document, name, payload);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

function stage(): Document {
  let document = emptyDocument("Living");
  document = run(document, "controller.create", {
    id: "energy",
    kind: "number",
    name: "Energy",
  });
  document = run(document, "controller.create", {
    id: "tint",
    kind: "color",
    name: "Tint",
    after: "energy",
  });
  document = run(document, "controller.create", {
    id: "g",
    kind: "group",
    name: "Folder",
    after: "tint",
  });
  document = run(document, "macro.create", { id: "hit", name: "Hit" });
  document = run(document, "macro.create", {
    id: "mg",
    kind: "group",
    name: "Hits",
  });
  return document;
}

describe("addresses", () => {
  it("resolves installation/blackout to the operational path", () => {
    expect(
      resolveAddress(emptyDocument("Test"), "installation/blackout"),
    ).toEqual({
      address: "installation/blackout",
      label: "Blackout",
      path: ["operational", "blackout"],
      type: "boolean",
      default: false,
    });
  });

  it("resolves a Controller's value with its type and range; a Group has none", () => {
    const document = stage();
    expect(resolveAddress(document, "controller/energy/value")).toEqual({
      address: "controller/energy/value",
      label: "Value",
      owner: "Energy",
      path: ["controllers", "energy", "value"],
      type: "number",
      range: { min: 0, max: 1, step: 0.01, percent: true },
    });
    expect(resolveAddress(document, "controller/tint/value")).toMatchObject({
      type: "color",
      owner: "Tint",
    });
    expect(resolveAddress(document, "controller/g/value")).toBeUndefined();
    expect(resolveAddress(document, "controller/zz/value")).toBeUndefined();
    expect(controllerAddress(document.controllers.energy!)?.address).toBe(
      "controller/energy/value",
    );
    expect(controllerAddress(document.controllers.g!)).toBeUndefined();
  });

  it("resolves a Macro's run as a trigger; a Group has none", () => {
    const document = stage();
    expect(resolveAddress(document, "macro/hit/run")).toEqual({
      address: "macro/hit/run",
      label: "Run",
      owner: "Hit",
      path: ["macros", "hit", "run"],
      type: "trigger",
    });
    expect(resolveAddress(document, "macro/mg/run")).toBeUndefined();
    expect(resolveAddress(document, "macro/hit/nope")).toBeUndefined();
    expect(resolveAddress(document, "macro/hit")).toBeUndefined();
  });

  it("lists every reachable Address in a stable order", () => {
    expect(listAddresses(stage()).map((entry) => entry.address)).toEqual([
      "installation/blackout",
      "installation/master",
      "macro/hit/run",
      "controller/energy/value",
      "controller/tint/value",
    ]);
  });

  it("links Master but never a Controller's value or Blackout", () => {
    const document = stage();
    const energy = resolveAddress(document, "controller/energy/value");
    const blackout = resolveAddress(document, "installation/blackout");
    const master = resolveAddress(document, "installation/master");
    if (!energy || !blackout || !master) throw new Error("unresolved");
    expect(linkable(energy, "number")).toBe(false);
    expect(linkable(blackout, "number")).toBe(false);
    expect(linkable(master, "number")).toBe(true);
    expect(linkable(master, "color")).toBe(false);
  });

  it("checks values against the resolved type", () => {
    const document = stage();
    const energy = resolveAddress(document, "controller/energy/value");
    const tint = resolveAddress(document, "controller/tint/value");
    const blackout = resolveAddress(document, "installation/blackout");
    const run = resolveAddress(document, "macro/hit/run");
    if (!energy || !tint || !blackout || !run) throw new Error("unresolved");
    expect(addressValueProblem(energy, 0.5)).toBeUndefined();
    expect(addressValueProblem(energy, 5)).toBe("must be between 0 and 1");
    expect(addressValueProblem(energy, "2")).toBe("must be a number");
    expect(addressValueProblem(energy, 0.373)).toBe(
      "must be a multiple of 0.01 from 0 (got 0.373)",
    );
    expect(addressValueProblem(tint, [0, 0, 0, 1])).toBeUndefined();
    expect(addressValueProblem(tint, [0, 0, 2, 1])).toBe(
      "must be a color of four components from 0 to 1",
    );
    expect(addressValueProblem(blackout, true)).toBeUndefined();
    expect(addressValueProblem(blackout, 1)).toBe("must be true or false");
    expect(addressValueProblem(run, undefined)).toBeUndefined();
    expect(addressValueProblem(run, 1)).toBe("is a trigger and takes no value");
    expect(sameAddressValue([1, 0, 0, 1], [1, 0, 0, 1])).toBe(true);
    expect(sameAddressValue([1, 0, 0, 1], [1, 0, 0, 0.5])).toBe(false);
  });
});
