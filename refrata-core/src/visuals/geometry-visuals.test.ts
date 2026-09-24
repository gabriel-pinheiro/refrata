import { describe, expect, it } from "vitest";

import { defaultParameterValues, type Color } from "../parameters.ts";
import { bandLevel, wedgePath } from "./geometry-sdk.ts";
import { angleBetween } from "./radar.ts";
import type { FrameSize, GeometryTarget, Pose } from "./sdk.ts";
import { definitionOf, seeded } from "./visual-harness.ts";
import { wipeCentre } from "./wipe.ts";

/** Points in Frame space by key, metres from the centre. */
type Points = Readonly<Record<string, readonly [number, number]>>;

const SIZE: FrameSize = { width: 4, height: 2 };

function placed(points: Points): GeometryTarget[] {
  const keys = Object.keys(points);
  return keys.map((key, index) => {
    const [x, y] = points[key] ?? [0, 0];
    return { key, index, count: keys.length, x, y };
  });
}

/** Runs one Geometry Visual by hand; `frame` steps it with points in a Frame and returns what it wrote. */
function playGeometry(
  id: string,
  overrides: Record<string, number | string | boolean | Color> = {},
) {
  const definition = definitionOf(id);
  const instance = definition.create({ random: seeded() });
  const params = {
    ...defaultParameterValues(definition.parameters),
    ...overrides,
  };
  return {
    cue: (key: string) => instance.cue?.(key),
    pose: (): Pose => instance.pose?.() ?? {},
    figure: (size: FrameSize = SIZE) =>
      definition.geometry?.figure(params, instance.pose?.() ?? {}, size) ?? [],
    frame(dt: number, points: Points, size: FrameSize = SIZE) {
      const written: Record<
        string,
        Record<string, [number | Color, number]>
      > = {};
      instance.update(
        {
          dt,
          params,
          targets: placed(points),
          geometry: { targets: placed(points), ...size },
        },
        (slot, target, value, alpha = 1) => {
          (written[slot] ??= {})[target.key] = [value, alpha];
        },
      );
      return written;
    },
    bare(dt: number, keys: readonly string[]) {
      const written: string[] = [];
      instance.update(
        {
          dt,
          params,
          targets: keys.map((key, index) => ({
            key,
            index,
            count: keys.length,
          })),
        },
        (slot, target) => {
          written.push(`${slot}:${target.key}`);
        },
      );
      return written;
    },
  };
}

const alphaOf = (
  written: Record<string, Record<string, [number | Color, number]>>,
  key: string,
) => written.level?.[key]?.[1] ?? 0;

describe("the Geometry SDK", () => {
  it("marks the four Geometry Visuals and no other", () => {
    const geometry = ["wipe", "radar", "spectrum", "ripple"];
    for (const id of geometry)
      expect(definitionOf(id).geometry, id).toBeDefined();
    expect(definitionOf("rainbow").geometry).toBeUndefined();
    expect(definitionOf("chase").geometry).toBeUndefined();
  });

  it("releases everything on a Layer without a Frame", () => {
    expect(playGeometry("wipe").bare(0.1, ["a", "b"])).toEqual([]);
    expect(playGeometry("spectrum").bare(0.1, ["a"])).toEqual([]);
  });

  it("ramps a band's edge by its softness", () => {
    expect(bandLevel(0, 1, 0.5)).toBe(1);
    expect(bandLevel(0.5, 1, 0.5)).toBe(1);
    expect(bandLevel(0.75, 1, 0.5)).toBeCloseTo(0.5);
    expect(bandLevel(1, 1, 0.5)).toBe(0);
    expect(bandLevel(0.9, 1, 0)).toBe(1);
    expect(bandLevel(1.1, 1, 0)).toBe(0);
  });

  it("draws a wedge as one arc, the long way round past 180°", () => {
    expect(wedgePath(0, 90, 1)).toBe("M 0 0 L 1 0 A 1 1 0 0 1 0 1 Z");
    expect(wedgePath(0, 270, 1)).toContain(" 0 1 1 ");
  });
});

describe("Wipe", () => {
  it("lights the Targets under the band and releases the rest", () => {
    const wipe = playGeometry("wipe", { rate: 0, width: 0.25, softness: 0 });
    wipe.cue("sync");
    // At phase 0 the band's centre sits half a band left of the Frame's edge.
    const written = wipe.frame(0, { left: [-2, 0], mid: [0, 0] });
    expect(alphaOf(written, "left")).toBe(1);
    expect(alphaOf(written, "mid")).toBe(0);
    expect(written.color?.left?.[0]).toEqual([1, 1, 1, 1]);
  });

  it("crosses the Frame in one period, bounces, and reports where it is", () => {
    expect(wipeCentre(0, 0.125, "forward")).toBeCloseTo(-0.125);
    expect(wipeCentre(1, 0.125, "forward")).toBeCloseTo(1.125);
    expect(wipeCentre(0, 0.125, "backward")).toBeCloseTo(1.125);
    expect(wipeCentre(0.25, 0.125, "bounce")).toBeCloseTo(0.5);
    expect(wipeCentre(0.75, 0.125, "bounce")).toBeCloseTo(0.5);
    const wipe = playGeometry("wipe", { rate: 1, width: 0.2, softness: 0 });
    wipe.frame(0.5, { mid: [0, 0] });
    expect(wipe.pose().centre).toBeCloseTo(0.5);
    expect(alphaOf(wipe.frame(0, { mid: [0, 0], far: [1.5, 0] }), "mid")).toBe(
      1,
    );
    expect(alphaOf(wipe.frame(0, { far: [1.5, 0] }), "far")).toBe(0);
  });

  it("figures the band as a rectangle the height of the Frame", () => {
    const wipe = playGeometry("wipe", { rate: 1, width: 0.5 });
    wipe.frame(0.5, {});
    const [band] = wipe.figure();
    expect(band?.d).toBe("M -1 -1 h 2 v 2 h -2 Z");
    expect(band?.color).toEqual([1, 1, 1, 1]);
  });
});

describe("Radar", () => {
  it("measures the shortest turn between angles", () => {
    expect(angleBetween(10, 350)).toBe(20);
    expect(angleBetween(-90, 270)).toBe(0);
    expect(angleBetween(0, 180)).toBe(180);
  });

  it("starts pointing up, turns clockwise at the rate and lights what the wedge covers", () => {
    const radar = playGeometry("radar", { rate: 0.25, angle: 40, softness: 0 });
    const up = radar.frame(0, { top: [0, 1], right: [1, 0], centre: [0, 0] });
    expect(alphaOf(up, "top")).toBe(1);
    expect(alphaOf(up, "right")).toBe(0);
    expect(alphaOf(up, "centre")).toBe(1);
    // A quarter turn clockwise in one second at 0.25 Hz points right.
    const right = radar.frame(1, { top: [0, 1], right: [1, 0] });
    expect(radar.pose().heading).toBeCloseTo(0);
    expect(alphaOf(right, "top")).toBe(0);
    expect(alphaOf(right, "right")).toBe(1);
    radar.cue("sync");
    radar.frame(0, {});
    expect(radar.pose().heading).toBe(90);
  });

  it("turns the other way on Counterclockwise and figures a wedge to the corners", () => {
    const radar = playGeometry("radar", {
      rate: 0.25,
      direction: "counterclockwise",
    });
    radar.frame(1, {});
    expect(radar.pose().heading).toBeCloseTo(180);
    const [wedge] = radar.figure({ width: 6, height: 8 });
    expect(wedge?.d.startsWith("M 0 0 L")).toBe(true);
    expect(wedge?.d).toContain("A 5 5");
  });
});

describe("Spectrum", () => {
  it("spreads the spectrum across the Frame's width and holds the edge colour past it", () => {
    const spectrum = playGeometry("spectrum", { rate: 0, hueSpread: 1 });
    const written = spectrum.frame(0, {
      left: [-2, 0],
      third: [-2 / 3, 0],
      past: [5, 0],
      right: [2, 0],
    });
    expect(written.color?.left?.[0]).toEqual([1, 0, 0, 1]);
    expect(written.color?.third?.[0]).toEqual([0, 0, 1, 1]);
    expect(written.color?.past?.[0]).toEqual(written.color?.right?.[0]);
  });

  it("travels at the rate, restarts on sync and figures strips of colour", () => {
    const spectrum = playGeometry("spectrum", { rate: 0.5 });
    spectrum.frame(0.5, {});
    expect(spectrum.pose().phase).toBeCloseTo(0.25);
    spectrum.cue("sync");
    spectrum.frame(0, {});
    expect(spectrum.pose().phase).toBe(0);
    const strips = spectrum.figure();
    expect(strips).toHaveLength(24);
    expect(strips[0]?.color?.[0]).toBeCloseTo(1);
  });
});

describe("Ripple", () => {
  it("launches a ring per Fire at rate 0 and it travels outward over Travel", () => {
    const ripple = playGeometry("ripple", {
      rate: 0,
      travel: 2,
      width: 0.2,
      softness: 0,
    });
    expect(ripple.frame(0.1, { centre: [0, 0] }).level).toBeUndefined();
    ripple.cue("fire");
    const launched = ripple.frame(0, { centre: [0, 0], corner: [2, 1] });
    expect(alphaOf(launched, "centre")).toBe(1);
    expect(alphaOf(launched, "corner")).toBe(0);
    // Half way through its travel the ring is half way to the corners.
    const half = ripple.frame(1, { centre: [0, 0], mid: [1, 0.5] });
    expect(alphaOf(half, "centre")).toBe(0);
    expect(alphaOf(half, "mid")).toBe(1);
    expect(ripple.pose().radii).toEqual([0.5]);
    ripple.frame(1.5, {});
    expect(ripple.pose().radii).toEqual([]);
  });

  it("launches at the rate, closes in on Inward, and figures stroked rings", () => {
    const ripple = playGeometry("ripple", {
      rate: 2,
      travel: 1,
      direction: "inward",
    });
    ripple.frame(0.5, {});
    expect(ripple.pose().radii).toEqual([1]);
    ripple.frame(0.5, {});
    const radii = ripple.pose().radii as readonly number[];
    expect(radii).toHaveLength(2);
    expect(radii[0]).toBeCloseTo(0.5);
    const rings = ripple.figure();
    expect(rings).toHaveLength(2);
    expect(rings[0]?.strokeWidth).toBeCloseTo(0.2 * Math.hypot(2, 1));
  });
});
