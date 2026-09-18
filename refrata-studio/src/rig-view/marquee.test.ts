import { describe, expect, it } from "vitest";

import { elementsInRect, rigBounds, shapeCentre } from "./marquee";

const shapes = [
  { key: "a", x: -0.5, y: 0.25, width: 0.4, height: 0.4 },
  { key: "b", x: 0.5, y: 0.25, width: 0.4, height: 0.4 },
];
const at = (x: number, rz = 0) => ({ x, y: 0, z: 0, rx: 0, ry: 0, rz });

describe("marquee", () => {
  it("picks shapes by centre, and a whole Fixture as its root", () => {
    const fixtures = [
      { id: "f1", position: at(0), shapes },
      { id: "f2", position: at(3), shapes },
    ];
    expect(elementsInRect(fixtures, { x1: -1, y1: -1, x2: 0, y2: 1 })).toEqual([
      "f1/a",
    ]);
    expect(elementsInRect(fixtures, { x1: 4, y1: 1, x2: -1, y2: -1 })).toEqual([
      "f1/root",
      "f2/root",
    ]);
    expect(
      elementsInRect(fixtures, { x1: 10, y1: 10, x2: 11, y2: 11 }),
    ).toEqual([]);
  });

  it("rotates shape centres with the Fixture", () => {
    const centre = shapeCentre(at(1, 90), shapes[1]!);
    expect(centre.x).toBeCloseTo(1 - 0.25);
    expect(centre.y).toBeCloseTo(0.5);
    expect(
      elementsInRect([{ id: "f", position: at(1, 90), shapes }], {
        x1: 0.5,
        y1: 0.4,
        x2: 1,
        y2: 0.6,
      }),
    ).toEqual(["f/b"]);
  });

  it("bounds the whole rig, rotated corners included", () => {
    expect(rigBounds([])).toBeUndefined();
    const bounds = rigBounds([
      { id: "f1", position: at(0), shapes },
      { id: "f2", position: at(3, 90), shapes },
      { id: "f3", position: at(-4), shapes: [] },
    ]);
    expect(bounds?.x1).toBeCloseTo(-4);
    expect(bounds?.y1).toBeCloseTo(-0.7);
    expect(bounds?.x2).toBeCloseTo(2.95);
    expect(bounds?.y2).toBeCloseTo(0.7);
  });
});
