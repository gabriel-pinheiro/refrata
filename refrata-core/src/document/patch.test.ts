import { describe, expect, it } from "vitest";

import {
  applyPatch,
  applyPatches,
  invertPatches,
  patchesOverlap,
  pathsOverlap,
  type Patch,
} from "./patch.ts";

describe("patches", () => {
  const document = {
    installation: { id: "i", name: "Living" },
    things: { a: { id: "a", name: "Beam" } },
  };

  it("sets nested values immutably", () => {
    const next = applyPatch(document, {
      op: "set",
      path: ["things", "a", "name"],
      value: "TV",
    });
    expect(next.things.a?.name).toBe("TV");
    expect(document.things.a?.name).toBe("Beam");
    expect(next.installation).toBe(document.installation);
  });

  it("creates intermediate nodes and removes keys", () => {
    const withB = applyPatch(document, {
      op: "set",
      path: ["things", "b"],
      value: { id: "b", name: "B" },
    });
    expect(Object.keys(withB.things)).toEqual(["a", "b"]);
    const withoutA = applyPatch(withB, {
      op: "remove",
      path: ["things", "a"],
    });
    expect(Object.keys(withoutA.things)).toEqual(["b"]);
  });

  it("inverts an ordered patch list back to the original", () => {
    const patches: Patch[] = [
      { op: "set", path: ["things", "b"], value: { id: "b", name: "B" } },
      { op: "set", path: ["things", "b", "name"], value: "B2" },
      { op: "remove", path: ["things", "a"] },
    ];
    const inverse = invertPatches(document, patches);
    const changed = applyPatches(document, patches);
    expect(applyPatches(changed, inverse)).toEqual(document);
  });

  it("detects overlapping paths by prefix", () => {
    expect(pathsOverlap(["things", "a"], ["things", "a", "name"])).toBe(true);
    expect(pathsOverlap(["things", "a"], ["things", "b"])).toBe(false);
    expect(
      patchesOverlap(
        [{ op: "remove", path: ["things"] }],
        [{ op: "set", path: ["things", "x", "name"], value: 1 }],
      ),
    ).toBe(true);
  });
});
