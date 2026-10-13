import { describe, expect, it } from "vitest";

import beamJson from "../../../refrata-library/generic/beam-moving-head.refrata-fixture";
import {
  addressText,
  channelRows,
  channelText,
  rangeClashes,
  segmentAt,
  topByte,
  wireBytes,
  writerText,
} from "./chart.ts";
import { nextSpreadRange } from "./edits/encoding.ts";
import { parseFixtureType } from "./fixture-type.ts";
import { freeKey, keyFromName, nameFromKey, nextRange } from "./keys.ts";
import { ENCODABLE_ATTRIBUTES, ruleOf, rulesFor } from "./rules.ts";

const parsed = parseFixtureType(beamJson);
if (!parsed.ok) throw new Error(parsed.error);
const mode = parsed.type.modes["12ch"]!;
const rows = channelRows(mode);
const row = (key: string) => {
  const found = rows.find((each) => each.key === key);
  if (found === undefined) throw new Error(`no Channel ${key}`);
  return found;
};

describe("a Mode as a chart", () => {
  it("numbers each Channel once, by its place in the Footprint", () => {
    expect(rows.map((each) => `${addressText(each)} ${each.name}`)).toEqual([
      "1–2 Pan",
      "3–4 Tilt",
      "5 Speed",
      "6 Dimmer",
      "7 Strobe",
      "8 Color",
      "9 Gobo",
      "10 Prism",
      "11 Auto",
      "12 Control",
    ]);
    expect(channelText(row("gobo"))).toBe("9 Gobo");
    expect(row("pan")).toMatchObject({
      bytes: 2,
      element: "root",
      elementName: "Beam Moving Head",
      rest: 0,
    });
  });

  it("names the Parameters that write a Channel and the ranges on it", () => {
    expect(row("gobo").writers.map(writerText)).toEqual([
      "Gobo, range",
      "Gobo shake, spread",
    ]);
    expect(row("speed").writers).toEqual([]);
    const prism = row("prism").segments;
    expect(
      prism.map(({ from, to, label, kind }) => ({ from, to, label, kind })),
    ).toEqual([
      { from: 0, to: 99, label: "Off", kind: "switch" },
      { from: 100, to: 127, label: "On", kind: "switch" },
      { from: 128, to: 255, label: "On", kind: "spread" },
    ]);
    expect(row("color").segments[1]).toMatchObject({
      label: "Red",
      kind: "swatch",
      color: [1, 0, 0],
      attribute: "color",
      element: "root",
    });
    expect(row("dimmer").segments).toMatchObject([
      { from: 0, to: 255, kind: "scale", label: "Dimmer" },
    ]);
  });

  it("finds the range a value is in by its most significant byte", () => {
    expect(topByte(2, 0x8040)).toBe(0x80);
    expect(wireBytes(2, 0x8040)).toEqual([0x80, 0x40]);
    expect(wireBytes(1, 200)).toEqual([200]);
    expect(segmentAt(row("prism"), 110)?.label).toBe("On");
    expect(segmentAt(row("gobo"), 7)?.label).toBe("Medium");
    // A continuous value sits in no named range.
    expect(segmentAt(row("dimmer"), 128)).toBeUndefined();
  });

  it("marks ranges that overlap", () => {
    const ranges = [[0, 9], [5, 20], [30, 40], undefined] as const;
    expect(ranges.map((_, index) => rangeClashes(ranges, index))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("keys and next ranges", () => {
  it("makes a key from a name, unique among its siblings", () => {
    expect(keyFromName("  Gobo Rotação 2! ")).toBe("gobo-rotacao-2");
    expect(keyFromName("—")).toBe("");
    expect(freeKey("ring", ["ring", "ring-2"])).toBe("ring-3");
    expect(freeKey("ring", [])).toBe("ring");
    expect(nameFromKey("gobo-rotation")).toBe("Gobo Rotation");
  });

  it("starts a new range where the highest ends, as wide as it", () => {
    expect(nextRange([])).toEqual([0, 255]);
    expect(
      nextRange([
        [10, 19],
        [0, 9],
      ]),
    ).toEqual([20, 29]);
    expect(nextRange([[240, 250]])).toEqual([251, 255]);
    expect(nextRange([[0, 255]])).toBeUndefined();
    // The prism Channel is full, so a spread falls back to all of it.
    expect(nextSpreadRange(mode, "prism")).toEqual([0, 255]);
  });
});

describe("Encoding rules", () => {
  it("offers the rules that read a kind, the first being what a new Parameter starts with", () => {
    expect(rulesFor("number")).toEqual(["scale", "multiply", "spread"]);
    expect(rulesFor("color")).toEqual(["color", "wheel"]);
    expect(rulesFor("choice")).toEqual(["range"]);
    expect(rulesFor("boolean")).toEqual(["switch"]);
    expect(ruleOf({ wheel: "color", multiply: ["dimmer"] })).toBe("wheel");
    expect(ruleOf({ multiply: ["red"] })).toBe("multiply");
  });

  it("leaves out an Attribute no rule reads", () => {
    expect(ENCODABLE_ATTRIBUTES).not.toContain("shutter");
    expect(ENCODABLE_ATTRIBUTES).toContain("gobo1");
  });
});
