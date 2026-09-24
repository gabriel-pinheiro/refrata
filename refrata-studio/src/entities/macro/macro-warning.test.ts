import type { Macro } from "@refrata/core";
import { describe, expect, it } from "vitest";

import { countMacroWarnings, macroWarning } from "./macro-warning.ts";

const macros = {
  empty: { id: "empty", kind: "macro", name: "Empty", actions: [] },
  strobe: {
    id: "strobe",
    kind: "macro",
    name: "Strobe",
    actions: [{ kind: "trigger", address: "scene/s/play" }],
  },
  bank: { id: "bank", kind: "group", name: "Bank" },
} as unknown as Record<"empty" | "strobe" | "bank", Macro>;

describe("macroWarning", () => {
  it("warns a Macro without actions, never a Group", () => {
    expect(macroWarning(macros.empty)?.label).toBe("No Actions");
    expect(macroWarning(macros.strobe)).toBeUndefined();
    expect(macroWarning(macros.bank)).toBeUndefined();
  });

  it("counts the rows that would warn", () => {
    expect(countMacroWarnings(macros)).toBe(1);
    expect(countMacroWarnings({})).toBe(0);
  });
});
