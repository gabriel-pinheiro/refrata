import type { Document } from "@refrata/core";
import { describe, expect, it } from "vitest";

import type { EntityKind, Removal } from "@/entities";

import { removalPlan, removedMessage } from "./removal-plan";

const document = {
  installation: { activeScene: "s1" },
  scenes: { s1: { name: "Scene 1" }, s2: { name: "Scene 2" } },
  layers: { l1: { name: "Base" }, l2: { name: "Beta" } },
} as unknown as Document;

const removals: Partial<Record<EntityKind, Removal>> = {
  scene: {
    noun: "Scene",
    command: "scene.remove",
    payload: (id) => ({ sceneId: id }),
    find: (doc, id) => doc.scenes[id],
    refusal: (doc, id) =>
      doc.installation.activeScene === id
        ? "Active Scene: play another first"
        : undefined,
  },
  layer: {
    noun: "Layer",
    command: "layer.remove",
    payload: (id) => ({ layerId: id }),
    find: (doc, id) => doc.layers[id],
  },
};
const removalOf = (kind: EntityKind) => removals[kind];

describe("Remove over the selection", () => {
  it("takes every removable entity, in selection order", () => {
    const plan = removalPlan(
      document,
      [
        { kind: "layer", id: "l2" },
        { kind: "installation" },
        { kind: "element", id: "f1/head" },
        { kind: "scene", id: "s2" },
        { kind: "layer", id: "gone" },
      ],
      removalOf,
    );
    expect(plan.targets.map((target) => target.id)).toEqual(["l2", "s2"]);
    expect(plan.refusals).toEqual([]);
  });

  it("leaves the active Scene, saying why, and removes the rest", () => {
    const plan = removalPlan(
      document,
      [
        { kind: "scene", id: "s1" },
        { kind: "layer", id: "l1" },
      ],
      removalOf,
    );
    expect(plan.targets.map((target) => target.id)).toEqual(["l1"]);
    expect(plan.refusals).toEqual(["Active Scene: play another first"]);
  });

  it("names one removal and counts several by kind", () => {
    const { targets } = removalPlan(
      document,
      [
        { kind: "layer", id: "l2" },
        { kind: "scene", id: "s2" },
        { kind: "layer", id: "l1" },
      ],
      removalOf,
    );
    expect(removedMessage(targets.slice(0, 1), "Ctrl+Z")).toBe(
      "Removed Layer “Beta”. Ctrl+Z undoes.",
    );
    expect(removedMessage(targets, "Ctrl+Z")).toBe(
      "Removed 2 Layers and 1 Scene. Ctrl+Z undoes them one at a time.",
    );
  });
});
