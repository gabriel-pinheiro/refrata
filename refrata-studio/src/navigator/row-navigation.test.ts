import { describe, expect, it } from "vitest";

import {
  arrowStep,
  neighbourAfterRemoval,
  type VisibleRow,
} from "./row-navigation";

// Installation
//   Scene A (open)
//     Layer 1
//     Group (closed)
//   Scene B (closed)
//   Macro (leaf)
const rows: readonly VisibleRow[] = [
  { id: "root", depth: 0 },
  { id: "sceneA", depth: 1, expanded: true },
  { id: "layer1", depth: 2 },
  { id: "group", depth: 2, expanded: false },
  { id: "sceneB", depth: 1, expanded: false },
  { id: "macro", depth: 1 },
];

describe("arrow keys over the navigator", () => {
  it("moves to the previous and next row, stopping at the ends", () => {
    expect(arrowStep(rows, "layer1", "ArrowDown")).toEqual({ select: "group" });
    expect(arrowStep(rows, "layer1", "ArrowUp")).toEqual({ select: "sceneA" });
    expect(arrowStep(rows, "root", "ArrowUp")).toBeUndefined();
    expect(arrowStep(rows, "macro", "ArrowDown")).toBeUndefined();
  });

  it("starts at the first or last row when none is current", () => {
    expect(arrowStep(rows, undefined, "ArrowDown")).toEqual({ select: "root" });
    expect(arrowStep(rows, "gone", "ArrowUp")).toEqual({ select: "macro" });
    expect(arrowStep(rows, undefined, "ArrowLeft")).toBeUndefined();
  });

  it("closes an open row on Left, else goes to the parent", () => {
    expect(arrowStep(rows, "sceneA", "ArrowLeft")).toEqual({
      toggle: "sceneA",
      open: false,
    });
    expect(arrowStep(rows, "group", "ArrowLeft")).toEqual({ select: "sceneA" });
    expect(arrowStep(rows, "layer1", "ArrowLeft")).toEqual({
      select: "sceneA",
    });
    expect(arrowStep(rows, "sceneB", "ArrowLeft")).toEqual({ select: "root" });
    expect(arrowStep(rows, "root", "ArrowLeft")).toBeUndefined();
  });

  it("opens a closed row on Right, else goes to its first child", () => {
    expect(arrowStep(rows, "sceneB", "ArrowRight")).toEqual({
      toggle: "sceneB",
      open: true,
    });
    expect(arrowStep(rows, "sceneA", "ArrowRight")).toEqual({
      select: "layer1",
    });
    expect(arrowStep(rows, "macro", "ArrowRight")).toBeUndefined();
  });

  it("does nothing on Right for an open row without children", () => {
    const empty: VisibleRow[] = [
      { id: "scene", depth: 1, expanded: true },
      { id: "next", depth: 1 },
    ];
    expect(arrowStep(empty, "scene", "ArrowRight")).toBeUndefined();
  });
});

describe("the row selected after a removal", () => {
  it("is the next row not inside what went, else the one above", () => {
    const next = (...ids: string[]) =>
      neighbourAfterRemoval(rows, new Set(ids));
    expect(next("layer1")).toBe("group");
    expect(next("group")).toBe("sceneB");
    // A Scene's Layers go with it.
    expect(next("sceneA")).toBe("sceneB");
    expect(next("macro")).toBe("sceneB");
    expect(next("unknown")).toBeUndefined();
  });

  it("skips every removed row of a selection of several", () => {
    const next = (...ids: string[]) =>
      neighbourAfterRemoval(rows, new Set(ids));
    expect(next("layer1", "group")).toBe("sceneB");
    expect(next("sceneB", "macro")).toBe("group");
    expect(next("sceneA", "sceneB", "macro")).toBe("root");
  });
});
