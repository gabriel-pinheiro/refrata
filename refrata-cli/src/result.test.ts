import { CommandError } from "@refrata/client";
import {
  createBuiltInRegistry,
  emptyDocument,
  executeCommand,
} from "@refrata/core";
import { describe, expect, it } from "vitest";

import {
  errorReport,
  formatCommandResult,
  formatWarnings,
  inTypedTerms,
  nameCreated,
} from "./result.ts";

describe("formatCommandResult", () => {
  it("names what a create made, with the revision", () => {
    expect(
      formatCommandResult(
        {
          revision: 3,
          changed: true,
          label: "Add Number Controller",
          created: [{ table: "controllers", id: "controller_ab12" }],
        },
        "controller.create",
      ),
    ).toBe("Add Number Controller → controller_ab12 (revision 3)");
  });

  it("names each created entity as it ended up, which may differ from the label", () => {
    expect(
      formatCommandResult(
        {
          revision: 4,
          changed: true,
          label: "Add Scene “Verse”",
          created: [{ table: "scenes", id: "scene_ab12", name: "Verse 1" }],
        },
        "scene.create",
      ),
    ).toBe("Add Scene “Verse” → scene_ab12 “Verse 1” (revision 4)");
  });

  it("falls back to the command name and lists warnings underneath", () => {
    expect(
      formatCommandResult(
        {
          revision: 9,
          changed: true,
          warnings: ["Removed 2 Macro actions targeting “Wash”"],
        },
        "macro.remove",
      ),
    ).toBe(
      "macro.remove (revision 9)\n  warning: Removed 2 Macro actions targeting “Wash”",
    );
    expect(formatCommandResult({ revision: 9, changed: false }, "x")).toBe(
      "No change.",
    );
  });

  it("indents warnings", () => {
    expect(formatWarnings(undefined)).toEqual([]);
    expect(formatWarnings(["a"])).toEqual(["  warning: a"]);
  });
});

describe("errorReport", () => {
  it("carries payload issues when the runtime listed them", () => {
    expect(
      errorReport(
        new CommandError("Invalid payload for “macro.create”: a; b", [
          "a",
          "b",
        ]),
      ),
    ).toEqual({
      error: "Invalid payload for “macro.create”: a; b",
      issues: ["a", "b"],
    });
  });

  it("keeps a plain error to its message", () => {
    expect(errorReport(new Error("No value at “macros/nope”."))).toEqual({
      error: "No value at “macros/nope”.",
    });
    expect(errorReport("boom")).toEqual({ error: "boom" });
  });
});

describe("nameCreated", () => {
  it("names what a create made as it ended up, not as it was asked", () => {
    const registry = createBuiltInRegistry();
    let document = emptyDocument("Living");
    for (const id of ["scene_a", "scene_b"]) {
      const result = executeCommand(registry, document, "scene.create", {
        id,
        name: "Verse",
      });
      if (!result.ok) throw new Error(result.error);
      document = result.document;
    }
    expect(nameCreated(document, [{ table: "scenes", id: "scene_b" }])).toEqual(
      [{ table: "scenes", id: "scene_b", name: "Verse 1" }],
    );
  });

  it("keeps the bare id when the replica has not caught up", () => {
    expect(
      nameCreated(emptyDocument("Living"), [{ table: "scenes", id: "s" }]),
    ).toEqual([{ table: "scenes", id: "s" }]);
    expect(nameCreated(undefined, [{ table: "scenes", id: "s" }])).toEqual([
      { table: "scenes", id: "s" },
    ]);
  });
});

describe("inTypedTerms", () => {
  it("retells an error with the Address as typed, keeping its kind and issues", () => {
    const retold = inTypedTerms(
      new CommandError("Unknown address “layer/lay_1/param/fish”: …", ["i"]),
      "layer/lay_1/param/fish",
      "layer/Wash/param/fish",
    );
    expect(retold).toBeInstanceOf(CommandError);
    expect((retold as CommandError).message).toBe(
      "Unknown address “layer/Wash/param/fish”: …",
    );
    expect((retold as CommandError).issues).toEqual(["i"]);
  });

  it("leaves an error alone when nothing was resolved", () => {
    const error = new Error("x");
    expect(inTypedTerms(error, "a/b", "a/b")).toBe(error);
    expect(inTypedTerms("boom", "a/b", "a/c")).toBe("boom");
  });
});
