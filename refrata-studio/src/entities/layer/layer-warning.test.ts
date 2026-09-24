import { DEFAULT_FADE, id, type Layer } from "@refrata/core";
import { describe, expect, it } from "vitest";

import { countLayerWarnings, layerWarning } from "./layer-warning.ts";

const base = {
  id: id("layer", "l"),
  name: "L",
  sceneId: id("scene", "s"),
  parentId: null,
  enabled: true,
  opacity: 1,
  fadeIn: DEFAULT_FADE,
  fadeOut: DEFAULT_FADE,
  order: "a0",
};

function look(targets: readonly string[]): Layer {
  return {
    ...base,
    kind: "look",
    blendMode: "normal",
    targets: targets.map((ref) => ({ ref, spread: false })),
    rows: {},
    all: {},
  };
}

describe("layerWarning", () => {
  it("names a Look or Visual Layer without Targets", () => {
    expect(layerWarning(look([]))?.label).toBe("No Targets");
    expect(layerWarning(look(["set:all"]))).toBeUndefined();
    expect(
      layerWarning({
        ...base,
        kind: "visual",
        blendMode: "normal",
        targets: [],
        visual: "chase",
        parameters: {},
        bindings: {},
      })?.label,
    ).toBe("No Targets");
  });

  it("never warns a Group", () => {
    expect(layerWarning({ ...base, kind: "group" })).toBeUndefined();
  });

  it("counts the rows that would warn", () => {
    expect(
      countLayerWarnings({
        a: look([]),
        b: { ...look(["set:all"]), id: id("layer", "b") },
        c: { ...base, id: id("layer", "c"), kind: "group" },
      }),
    ).toBe(1);
  });
});
