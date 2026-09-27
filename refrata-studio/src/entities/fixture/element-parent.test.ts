import type { Document } from "@refrata/core";
import { describe, expect, it } from "vitest";

import { elementParent } from "./element-parent";

const document = {
  fixtures: { strobe: { kind: "fixture", parentId: null } },
} as unknown as Document;

describe("elementParent", () => {
  it("is the Fixture the ref names, when the document holds it", () => {
    expect(elementParent(document, "strobe/panel-1")).toEqual({
      kind: "fixture",
      id: "strobe",
    });
    expect(elementParent(document, "gone/panel-1")).toBeUndefined();
    expect(elementParent(document, "strobe")).toBeUndefined();
  });
});
