import { describe, expect, it } from "vitest";

import {
  pickedRefs,
  selectedMembers,
  selectedTargets,
} from "./selected-targets";
import { pickItems, type Selection } from "./selection";

const a: Selection = { kind: "fixture", id: "a" };
const b: Selection = { kind: "element", id: "b/panel-1" };
const s: Selection = { kind: "set", id: "s" };

describe("pickItems", () => {
  it("replaces, extends without duplicates, and toggles", () => {
    expect(pickItems([a], [b, b], "replace")).toEqual([b]);
    expect(pickItems([a], [a, b], "add")).toEqual([a, b]);
    expect(pickItems([a, b], [a, s], "toggle")).toEqual([b, s]);
    expect(pickItems([a], [], "replace")).toEqual([]);
  });
});

describe("selectedTargets", () => {
  const document = {
    fixtures: {
      a: { kind: "fixture" },
      g: { kind: "group" },
    },
    fixtureSets: { s: { kind: "set" } },
  } as unknown as Parameters<typeof selectedTargets>[0];

  it("maps Fixtures, Elements and Sets to refs in order", () => {
    expect(selectedTargets(document, [b, a, s])).toEqual([
      "b/panel-1",
      "a/root",
      "set:s",
    ]);
    expect(pickedRefs([b, a, s])).toEqual(["b/panel-1", "a/root"]);
  });

  it("refuses a selection holding anything else, and members refuse Sets", () => {
    expect(selectedTargets(document, [])).toBeUndefined();
    expect(
      selectedTargets(document, [a, { kind: "layer", id: "l" }]),
    ).toBeUndefined();
    expect(
      selectedTargets(document, [{ kind: "fixture", id: "g" }]),
    ).toBeUndefined();
    expect(selectedMembers(document, [a, s])).toBeUndefined();
    expect(selectedMembers(document, [a, b])).toEqual(["a/root", "b/panel-1"]);
  });
});
