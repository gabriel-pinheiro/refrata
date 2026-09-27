import type { Document } from "@refrata/core";
import { describe, expect, it } from "vitest";

import { layerParent } from "./layer-parent";

const document = {
  layers: {
    group: { sceneId: "s1", parentId: null },
    look: { sceneId: "s1", parentId: "group" },
  },
} as unknown as Document;

describe("layerParent", () => {
  it("is the Group a Layer is in, else its Scene", () => {
    expect(layerParent(document, "look")).toEqual({
      kind: "layer",
      id: "group",
    });
    expect(layerParent(document, "group")).toEqual({ kind: "scene", id: "s1" });
    expect(layerParent(document, "gone")).toBeUndefined();
  });
});
