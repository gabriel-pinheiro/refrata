import { describe, expect, it } from "vitest";

import { parsePick, pickSelection, samePick, type Pick } from "./type-ref";

const TYPE = "generic/beam-moving-head";

describe("a pick as a selection", () => {
  it("goes to an entity kind and id and back", () => {
    const picks: readonly Pick[] = [
      { kind: "type" },
      { kind: "mode" },
      { kind: "channel", key: "gobo" },
      { kind: "element", key: "pixel-3" },
      { kind: "parameter", element: "root", attribute: "gobo1-shake" },
      { kind: "action", key: "reset" },
    ];
    for (const pick of picks) {
      const selection = pickSelection(TYPE, "12ch", pick);
      if (selection.kind === "installation") throw new Error("not a pick");
      const parsed = parsePick(selection.kind, selection.id);
      expect(parsed?.typeKey).toBe(TYPE);
      expect(parsed?.modeKey).toBe(pick.kind === "type" ? undefined : "12ch");
      expect(samePick(parsed?.pick, pick)).toBe(true);
    }
  });

  it("names a type by its key alone, and the rest by type, Mode and key", () => {
    expect(pickSelection(TYPE, "12ch", { kind: "type" })).toEqual({
      kind: "fixtureType",
      id: TYPE,
    });
    expect(
      pickSelection(TYPE, "12ch", {
        kind: "parameter",
        element: "root",
        attribute: "color",
      }),
    ).toEqual({ kind: "typeParameter", id: `${TYPE}|12ch|root|color` });
  });

  it("is no pick for another kind or an id cut short", () => {
    expect(parsePick("fixture", "fx_1")).toBeUndefined();
    expect(parsePick("typeChannel", `${TYPE}|12ch`)).toBeUndefined();
    expect(parsePick("typeParameter", `${TYPE}|12ch|root`)).toBeUndefined();
    expect(parsePick("typeMode", TYPE)).toBeUndefined();
  });
});
