import { executeCommand, createBuiltInRegistry } from "@refrata/core";
import { describe, expect, it } from "vitest";

import { formatSets, formatStack } from "./composition-lines.ts";
import { stageLook } from "./composition-lines.test.ts";
import { formatFixtures } from "./rig-lines.ts";
import {
  formatRule,
  formatTags,
  normaliseTags,
  parseRule,
  ruleIndex,
} from "./tag-lines.ts";

const registry = createBuiltInRegistry();

function tagged() {
  let document = stageLook();
  for (const [name, payload] of [
    ["fixture.tags.add", { refs: ["par/root"], tags: ["wall"] }],
    ["fixture.tags.add", { refs: ["strobe/panel-2"], tags: ["hero"] }],
    [
      "set.create",
      { id: "mixed", name: "Mixed", rules: [["panel", "odd"], ["ghost"], []] },
    ],
    [
      "layer.targets.spread",
      { layerId: "base", ref: "set:wash", spread: true },
    ],
  ] as const) {
    const result = executeCommand(registry, document, name, payload);
    if (!result.ok) throw new Error(result.error);
    document = result.document;
  }
  return document;
}

describe("Tags as typed", () => {
  it("normalises and says so", () => {
    expect(normaliseTags(["Truss Left", "wall", "wall"])).toEqual({
      tags: ["truss-left", "wall"],
      notes: ["“Truss Left” is written truss-left"],
    });
    expect(() => normaliseTags(["--"])).toThrow(/nothing a Tag can keep/);
  });

  it("reads a Rule from a comma list, keeping a Fixture Type key", () => {
    expect(parseRule("panel, Odd").tags).toEqual(["panel", "odd"]);
    expect(parseRule("generic/atomic-like-panel").tags).toEqual([
      "generic/atomic-like-panel",
    ]);
    expect(parseRule("").tags).toEqual([]);
    expect(ruleIndex("2")).toBe(1);
    expect(() => ruleIndex("0")).toThrow(/count from 1/);
  });

  it("labels Rules", () => {
    expect(formatRule([])).toBe("every Fixture");
    expect(formatRule(["panel", "ghost"], new Set(["ghost"]))).toBe(
      "panel + ghost (matches nothing)",
    );
  });
});

describe("Tags in listings", () => {
  it("counts Tags and says who put them", () => {
    const lines = formatTags(tagged());
    expect(lines.find((line) => line.startsWith("wall"))).toMatch(
      /1 Element {3}person's/,
    );
    expect(lines.find((line) => line.startsWith("panel "))).toMatch(
      /8 Elements {2}declared/,
    );
  });

  it("prints Tags beside Fixtures and Elements", () => {
    const lines = formatFixtures(tagged());
    expect(lines.find((line) => line.includes("“Par”"))).toContain(
      "[root generic/rgb-3ch +wall]",
    );
    expect(lines.find((line) => line.includes("strobe/panel-2"))).toContain(
      "[panel-2 panel even bottom +hero]",
    );
  });

  it("prints a rule Set with numbered Rules and live members", () => {
    const line = formatSets(tagged()).find((text) => text.includes("Mixed"));
    expect(line).toContain(
      "by rule: 1. panel + odd  2. ghost (matches nothing)  3. every Fixture",
    );
    // The empty Rule makes both roots members, which drops the Panels under the Strobe.
    expect(line).toContain("2 members: Strobe, Par");
  });

  it("prints what a spread Target expands to", () => {
    const lines = formatStack(tagged(), "verse");
    expect(lines.find((line) => line.includes("“Base”"))).toContain(
      "Wash (spread)",
    );
    expect(
      lines.some((line) =>
        line.endsWith("Wash spreads to: Par, Strobe › Panel 1"),
      ),
    ).toBe(true);
  });
});
