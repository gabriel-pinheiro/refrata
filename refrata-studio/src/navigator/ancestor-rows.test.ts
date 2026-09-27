import type { Document } from "@refrata/core";
import { describe, expect, it } from "vitest";

import type { EntityKind } from "@/entities";

import {
  ancestorRows,
  groupParent,
  revealedRow,
  type RowParent,
} from "./ancestor-rows";

const document = {
  presets: {
    outer: { parentId: null },
    inner: { parentId: "outer" },
    deep: { parentId: "inner" },
    top: { parentId: null },
    loopA: { parentId: "loopB" },
    loopB: { parentId: "loopA" },
  },
  scenes: { s1: {} },
  layers: {
    group: { sceneId: "s1", parentId: null },
    look: { sceneId: "s1", parentId: "group" },
  },
} as unknown as Document;

const parents: Partial<Record<EntityKind, RowParent>> = {
  preset: groupParent("preset", (held) => held.presets),
  layer: (held, id) => {
    const layer = held.layers[id];
    if (layer === undefined) return undefined;
    return layer.parentId === null
      ? { kind: "scene", id: layer.sceneId }
      : { kind: "layer", id: layer.parentId };
  },
};
const parentOf = (kind: EntityKind): RowParent | undefined => parents[kind];

describe("groupParent", () => {
  const parent = groupParent("preset", (held) => held.presets);

  it("is the Group an entity is in, and nothing at the root or when missing", () => {
    expect(parent(document, "deep")).toEqual({ kind: "preset", id: "inner" });
    expect(parent(document, "top")).toBeUndefined();
    expect(parent(document, "gone")).toBeUndefined();
  });
});

describe("ancestorRows", () => {
  it("walks every level, nearest first", () => {
    expect(
      ancestorRows(document, { kind: "preset", id: "deep" }, parentOf),
    ).toEqual([
      { kind: "preset", id: "inner" },
      { kind: "preset", id: "outer" },
    ]);
  });

  it("crosses kinds where a row nests under another kind", () => {
    expect(
      ancestorRows(document, { kind: "layer", id: "look" }, parentOf),
    ).toEqual([
      { kind: "layer", id: "group" },
      { kind: "scene", id: "s1" },
    ]);
  });

  it("is empty for a root row, a missing entity and a kind that never nests", () => {
    expect(
      ancestorRows(document, { kind: "preset", id: "top" }, parentOf),
    ).toEqual([]);
    expect(
      ancestorRows(document, { kind: "preset", id: "gone" }, parentOf),
    ).toEqual([]);
    expect(
      ancestorRows(document, { kind: "scene", id: "s1" }, parentOf),
    ).toEqual([]);
  });

  it("ends a chain that loops", () => {
    expect(
      ancestorRows(document, { kind: "preset", id: "loopA" }, parentOf),
    ).toEqual([{ kind: "preset", id: "loopB" }]);
  });
});

describe("revealedRow", () => {
  const fixture = { kind: "fixture", id: "a" } as const;
  const element = { kind: "element", id: "a/panel-1" } as const;

  it("is the one selected entity", () => {
    expect(revealedRow([fixture])).toEqual(fixture);
    expect(revealedRow([element])).toEqual(element);
  });

  it("is nothing for several items, none, or the Installation", () => {
    expect(revealedRow([fixture, element])).toBeUndefined();
    expect(revealedRow([])).toBeUndefined();
    expect(revealedRow([{ kind: "installation" }])).toBeUndefined();
  });
});
