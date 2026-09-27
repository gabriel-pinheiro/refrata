import type { Document } from "@refrata/core";
import { describe, expect, it } from "vitest";

import { outputParent } from "./output-parent";

const document = {
  outputs: { o1: { universeId: "u1" } },
} as unknown as Document;

describe("outputParent", () => {
  it("is the Universe an Output sends", () => {
    expect(outputParent(document, "o1")).toEqual({
      kind: "universe",
      id: "u1",
    });
    expect(outputParent(document, "gone")).toBeUndefined();
  });
});
