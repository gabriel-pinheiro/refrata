import { describe, expect, it } from "vitest";

import dimmerJson from "../../../refrata-library/generic/dimmer-1ch.json" with { type: "json" };
import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import rgbwJson from "../../../refrata-library/generic/rgbw-4ch.json" with { type: "json" };
import strobeJson from "../../../refrata-library/showtech/st-960.json" with { type: "json" };

import {
  elementsOf,
  elementRef,
  parseElementRef,
  subtreeOf,
} from "./elements.ts";
import { encodeMode } from "./encoding.ts";
import {
  footprintOf,
  parseFixtureType,
  type FixtureType,
  type Mode,
} from "./fixture-type.ts";
import { placeShape, shapeWidth } from "./shapes.ts";

function load(json: unknown): FixtureType {
  const parsed = parseFixtureType(json);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.type;
}

function mode(type: FixtureType, key: string): Mode {
  const found = type.modes[key];
  if (found === undefined) throw new Error(`no mode ${key}`);
  return found;
}

const rgb = mode(load(rgbJson), "3ch");
const rgbw = mode(load(rgbwJson), "4ch");
const dimmer = mode(load(dimmerJson), "1ch");
const strobeType = load(strobeJson);
const strobe32 = mode(strobeType, "32ch");

function encode(
  target: Mode,
  values: Record<string, Record<string, unknown>>,
): number[] {
  return [
    ...encodeMode(target, elementsOf(target), (key) => values[key] as never),
  ];
}

describe("Fixture Type files", () => {
  it("parse the bundled types with their footprints", () => {
    expect(footprintOf(dimmer)).toBe(1);
    expect(footprintOf(rgb)).toBe(3);
    expect(footprintOf(rgbw)).toBe(4);
    expect(footprintOf(strobe32)).toBe(32);
    expect(footprintOf(mode(strobeType, "3ch"))).toBe(3);
  });

  it("refuse dangling references", () => {
    const broken = parseFixtureType({
      kind: "refrata-fixture-type",
      formatVersion: 1,
      key: "x/y",
      manufacturer: "X",
      model: "Y",
      modes: {
        a: {
          name: "a",
          channels: [{ key: "c", element: "nowhere" }],
          elements: {
            root: {
              name: "R",
              parameters: { dimmer: { encode: { scale: "zzz" } } },
            },
          },
        },
      },
    });
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error).toContain("nowhere");
  });
});

describe("Elements", () => {
  it("derive the strobe's tree in order with tags", () => {
    const elements = elementsOf(strobe32);
    expect(elements.map((element) => element.key).slice(0, 4)).toEqual([
      "root",
      "backlight",
      "panel-1",
      "panel-2",
    ]);
    expect(elements).toHaveLength(19);
    expect(elements.find((element) => element.key === "panel-3")?.tags).toEqual(
      ["panel-3", "panel", "odd"],
    );
    expect(
      subtreeOf(elements, "strobe").map((element) => element.key),
    ).toHaveLength(9);
    expect(elements.find((element) => element.key === "section-2")?.depth).toBe(
      2,
    );
  });

  it("read and write element references", () => {
    expect(elementRef("fixture_1", "panel-3")).toBe("fixture_1/panel-3");
    expect(parseElementRef("fixture_1/panel-3")).toEqual({
      fixtureId: "fixture_1",
      key: "panel-3",
    });
    expect(parseElementRef("nothing")).toBeUndefined();
  });
});

describe("Encoding", () => {
  it("scales a dimmer to one byte", () => {
    expect(encode(dimmer, { root: { dimmer: 0.5 } })).toEqual([128]);
    expect(encode(dimmer, { root: { dimmer: 1 } })).toEqual([255]);
  });

  it("multiplies colour bytes by a virtual dimmer", () => {
    expect(encode(rgb, { root: { color: [1, 0, 0, 1], dimmer: 0.5 } })).toEqual(
      [128, 0, 0],
    );
    expect(encode(rgb, { root: { color: [1, 1, 1, 1], dimmer: 1 } })).toEqual([
      255, 255, 255,
    ]);
    expect(encode(rgb, { root: { color: [1, 0, 0, 1], dimmer: 0 } })).toEqual([
      0, 0, 0,
    ]);
  });

  it("extracts white by subtraction on RGBW", () => {
    expect(encode(rgbw, { root: { color: [1, 1, 1, 1], dimmer: 1 } })).toEqual([
      0, 0, 0, 255,
    ]);
    expect(
      encode(rgbw, { root: { color: [1, 0.5, 0.5, 1], dimmer: 1 } }),
    ).toEqual([128, 0, 0, 128]);
  });

  it("ignores alpha and rests at defaults", () => {
    expect(encode(rgb, { root: { color: [0, 0, 1, 0.2], dimmer: 1 } })).toEqual(
      [0, 0, 255],
    );
    expect(encode(rgb, {})).toEqual([0, 0, 0]);
  });

  it("lays the strobe's 32 channels out as 8 × RGB then 8 × white", () => {
    const bytes = encode(strobe32, {
      "panel-1": { color: [1, 0, 0, 1], dimmer: 1 },
      "panel-8": { color: [0, 0, 1, 1], dimmer: 0.5 },
      "section-1": { dimmer: 1 },
      "section-8": { dimmer: 0.25 },
    });
    expect(bytes.slice(0, 3)).toEqual([255, 0, 0]);
    expect(bytes.slice(21, 24)).toEqual([0, 0, 128]);
    expect(bytes[24]).toBe(255);
    expect(bytes[31]).toBe(64);
    expect(bytes.filter((byte) => byte !== 0)).toHaveLength(4);
  });
});

describe("Shapes", () => {
  it("place the strobe as panels above and below one line of sections", () => {
    const placed = placeShape(strobe32.shape, elementsOf(strobe32));
    expect(placed).toHaveLength(16);
    const y = (key: string): number =>
      placed.find((shape) => shape.key === key)?.y ?? Number.NaN;
    expect(y("panel-1")).toBeCloseTo(y("panel-4"));
    expect(y("panel-5")).toBeCloseTo(y("panel-8"));
    expect(y("panel-1")).toBeGreaterThan(y("section-1"));
    expect(y("section-1")).toBeGreaterThan(y("panel-5"));
    expect(y("section-1")).toBeCloseTo(y("section-8"));
    expect(shapeWidth(placed)).toBeCloseTo(1);
    expect(placeShape(rgb.shape, elementsOf(rgb))).toHaveLength(1);
  });
});
