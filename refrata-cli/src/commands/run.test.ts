import { CommandError } from "@refrata/client";
import { createBuiltInRegistry } from "@refrata/core";
import { describe, expect, it } from "vitest";

import { describeCommand, nothingToDo } from "./run.ts";

interface ObjectSchema {
  readonly required?: readonly string[];
  readonly properties: Record<string, unknown>;
}

describe("describeCommand", () => {
  it("requires only what a caller must send: defaulted and optional fields are not required", () => {
    const description = describeCommand(
      createBuiltInRegistry(),
      "controller.create",
    );
    const payload = description.payload as ObjectSchema;
    expect(description.kind).toBe("authoring");
    expect(Object.keys(payload.properties).sort()).toEqual([
      "addresses",
      "after",
      "id",
      "kind",
      "name",
      "parentId",
    ]);
    expect([...(payload.required ?? [])].sort()).toEqual(["kind"]);
  });

  it("names the unknown command and where to look", () => {
    expect(() => describeCommand(createBuiltInRegistry(), "nope.x")).toThrow(
      "Unknown command “nope.x”. Try `refrata commands`.",
    );
  });
});

describe("nothingToDo", () => {
  it("takes an undo or redo with no step as an answer, not a failure", () => {
    expect(nothingToDo(new CommandError("Nothing to undo."), "undo")).toBe(
      "Nothing to undo.",
    );
    expect(nothingToDo(new CommandError("Nothing to redo."), "redo")).toBe(
      "Nothing to redo.",
    );
    expect(
      nothingToDo(new CommandError("Nothing to undo."), "redo"),
    ).toBeUndefined();
    expect(nothingToDo(new Error("Nothing to undo."), "undo")).toBeUndefined();
  });
});
