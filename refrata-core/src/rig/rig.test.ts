import { describe, expect, it } from "vitest";

import dimmerJson from "../../../refrata-library/generic/dimmer-1ch.json" with { type: "json" };
import beamJson from "../../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import moverJson from "../../../refrata-library/generic/moving-head.json" with { type: "json" };
import rgbJson from "../../../refrata-library/generic/rgb-3ch.json" with { type: "json" };
import rgbwJson from "../../../refrata-library/generic/rgbw-4ch.json" with { type: "json" };
import strobeJson from "../../../refrata-library/generic/atomic-like-panel.json" with { type: "json" };

import {
  elementsOf,
  elementRef,
  parseElementRef,
  subtreeOf,
} from "./elements.ts";
import { encodeMode } from "./encoding.ts";
import { nearestSwatch, snapToGamut } from "./gamut.ts";
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
const moverType = load(moverJson);
const mover8 = mode(moverType, "8ch");
const mover10 = mode(moverType, "10ch");
const strobeType = load(strobeJson);
const strobe32 = mode(strobeType, "32ch");
const beamType = load(beamJson);
const beam12 = mode(beamType, "12ch");

function encode(
  target: Mode,
  values: Record<string, Record<string, unknown>>,
): number[] {
  return [
    ...encodeMode(target, elementsOf(target), (key) => values[key] as never),
  ];
}

describe("Fixture Type files", () => {
  it("parse with their footprints", () => {
    expect(footprintOf(dimmer)).toBe(1);
    expect(footprintOf(rgb)).toBe(3);
    expect(footprintOf(rgbw)).toBe(4);
    expect(footprintOf(mover8)).toBe(8);
    expect(footprintOf(mover10)).toBe(10);
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
      ["panel-3", "panel", "odd", "bottom"],
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

  it("centres a moving head at rest and spreads pan and tilt over their bytes", () => {
    expect(encode(mover8, {})).toEqual([128, 128, 0, 0, 0, 0, 0, 0]);
    expect(encode(mover10, {}).slice(0, 4)).toEqual([128, 0, 128, 0]);
    const bytes = encode(mover10, {
      root: {
        pan: 270,
        tilt: -135,
        dimmer: 1,
        strobe: 15,
        color: [1, 0, 0, 1],
      },
    });
    expect(bytes).toEqual([255, 255, 0, 0, 255, 128, 255, 0, 0, 0]);
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

describe("Encoding a wheel head", () => {
  const rest = encode(beam12, {});

  it("rests centred with the wheel on white, the gobo open and the prism off", () => {
    expect(rest).toHaveLength(12);
    expect(rest.slice(0, 4)).toEqual([128, 0, 128, 0]);
    expect(rest[5]).toBe(0);
    expect(rest[7]).toBe(0);
    expect(rest[8]).toBe(0);
    expect(rest[9]).toBe(0);
    expect(rest.slice(10)).toEqual([0, 0]);
  });

  it("writes a colour as its swatch's bytes and lets its brightness dim the dimmer", () => {
    const full = encode(beam12, { root: { color: [1, 0, 0, 1], dimmer: 1 } });
    expect(full[7]).toBe(10);
    expect(full[5]).toBe(255);
    const half = encode(beam12, { root: { color: [0.5, 0, 0, 1], dimmer: 1 } });
    expect(half[7]).toBe(10);
    expect(half[5]).toBe(128);
    const grey = encode(beam12, {
      root: { color: [0.2, 0.2, 0.2, 1], dimmer: 0.5 },
    });
    expect(grey[7]).toBe(0);
    expect(grey[5]).toBe(Math.round(255 * 0.5 * 0.2));
  });

  it("writes a gobo's range, then its shake range when the shake is above zero", () => {
    expect(encode(beam12, { root: { gobo1: "flower" } })[8]).toBe(84);
    const slow = encode(beam12, {
      root: { gobo1: "flower", "gobo1-shake": 0.01 },
    });
    expect(slow[8]).toBe(90);
    const fast = encode(beam12, { root: { gobo1: "open", "gobo1-shake": 1 } });
    expect(fast[8]).toBe(179);
  });

  it("ignores a prism rotation while the prism is off and spreads it once on", () => {
    expect(encode(beam12, { root: { "prism-rotation": 1 } })[9]).toBe(0);
    expect(encode(beam12, { root: { prism: true } })[9]).toBe(100);
    expect(
      encode(beam12, { root: { prism: true, "prism-rotation": 0.5 } })[9],
    ).toBe(128 + 64);
  });

  it("offers the type's gobo options, its default first", () => {
    const root = elementsOf(beam12)[0]!;
    const gobo = root.parameters.gobo1!.definition;
    expect(gobo.kind).toBe("choice");
    if (gobo.kind !== "choice") return;
    expect(gobo.options).toHaveLength(15);
    expect(gobo.options[14]?.label).toBe("Flower");
    expect(gobo.default).toBe("open");
    expect(beam12.actions.reset?.channel).toBe("control");
  });
});

describe("Gamut", () => {
  const swatches = elementsOf(beam12)[0]!.parameters.color!.swatches!;

  it("snaps by hue, keeps brightness and sends black and grey to white", () => {
    expect(nearestSwatch([0.3, 0, 0, 1], swatches)?.label).toBe("Red");
    expect(nearestSwatch([0, 0, 0, 1], swatches)?.label).toBe("White");
    expect(nearestSwatch([0.4, 0.4, 0.4, 1], swatches)?.label).toBe("White");
    expect(nearestSwatch([1, 0.95, 0.85, 1], swatches)?.label).toBe(
      "Warm White",
    );
    expect(snapToGamut([0.5, 0.2, 0, 0.7], swatches)).toEqual([
      0.5, 0.25, 0, 0.7,
    ]);
  });
});

describe("Fixture Type rules", () => {
  const withRoot = (parameters: unknown, options?: unknown): unknown => ({
    ...beamJson,
    modes: {
      "12ch": {
        ...beamJson.modes["12ch"],
        elements: {
          root: {
            name: "Head",
            parameters: {
              ...beamJson.modes["12ch"].elements.root.parameters,
              ...(parameters as object),
            },
          },
        },
        ...(options as object),
      },
    },
  });

  it("refuse a rule of the wrong kind, options on a closed choice and a spread over an unknown option", () => {
    const wrongKind = parseFixtureType(
      withRoot({ dimmer: { encode: { range: "dimmer" } } }),
    );
    expect(wrongKind.ok).toBe(false);
    const closed = parseFixtureType(
      withRoot({
        shutter: {
          options: [{ value: "open", label: "Open", bytes: [0, 0] }],
          encode: { range: "strobe" },
        },
      }),
    );
    expect(closed.ok).toBe(false);
    const unknownOption = parseFixtureType(
      withRoot({
        "gobo1-shake": {
          encode: { spread: "gobo", by: "gobo1", ranges: { moon: [1, 2] } },
        },
      }),
    );
    expect(unknownOption.ok).toBe(false);
    if (!unknownOption.ok) expect(unknownOption.error).toContain("moon");
    const badAction = parseFixtureType(
      withRoot(
        {},
        {
          actions: {
            reset: { name: "Reset", channel: "nope", byte: 1, seconds: 1 },
          },
        },
      ),
    );
    expect(badAction.ok).toBe(false);
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
    expect(y("panel-5")).toBeGreaterThan(y("section-1"));
    expect(y("section-1")).toBeGreaterThan(y("panel-1"));
    expect(y("section-1")).toBeCloseTo(y("section-8"));
    expect(shapeWidth(placed)).toBeCloseTo(1);
    expect(placeShape(rgb.shape, elementsOf(rgb))).toHaveLength(1);
  });
});
