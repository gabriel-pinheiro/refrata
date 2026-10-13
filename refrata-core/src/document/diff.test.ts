import { describe, expect, it } from "vitest";

import { diffPatches } from "./diff.ts";
import { applyPatches } from "./patch.ts";

describe("diffPatches", () => {
  it("returns one patch per property that changed, a list whole", () => {
    const before = {
      a: { name: "Par", list: [1, 2], nested: { x: 1, y: 2 }, gone: true },
    };
    const after = {
      a: { name: "Par", list: [1, 2, 3], nested: { x: 1, y: 3 }, added: "new" },
    };
    const patches = diffPatches(before.a, after.a, ["a"]);
    expect(patches).toEqual([
      { op: "remove", path: ["a", "gone"] },
      { op: "set", path: ["a", "list"], value: [1, 2, 3] },
      { op: "set", path: ["a", "nested", "y"], value: 3 },
      { op: "set", path: ["a", "added"], value: "new" },
    ]);
    expect(applyPatches(before, patches)).toEqual(after);
  });

  it("returns nothing for equal values, whatever their identity", () => {
    expect(
      diffPatches({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }, ["x"]),
    ).toEqual([]);
  });
});
