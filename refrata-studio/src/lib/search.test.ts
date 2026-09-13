import { describe, expect, it } from "vitest";

import { isSubsequence, matchTier } from "./search.ts";

describe("isSubsequence", () => {
  it("finds the letters in order, anywhere", () => {
    expect(isSubsequence("plm", "plasma")).toBe(true);
    expect(isSubsequence("pmz", "plasma")).toBe(false);
    expect(isSubsequence("", "plasma")).toBe(true);
  });
});

describe("matchTier", () => {
  it("ranks a prefix over a word prefix over letters in order", () => {
    expect(matchTier("pl", "Plasma")).toBe(0);
    expect(matchTier("st", "Drifting Stars")).toBe(1);
    expect(matchTier("dst", "Drifting Stars")).toBe(2);
    expect(matchTier("zz", "Drifting Stars")).toBeUndefined();
  });

  it("skips letters in order when told not to be fuzzy", () => {
    expect(matchTier("dst", "Drifting Stars", false)).toBeUndefined();
    expect(matchTier("drift", "Drifting Stars", false)).toBe(0);
  });
});
