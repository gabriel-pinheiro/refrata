import type { Element, PlacedShape } from "@refrata/core";
import { describe, expect, it } from "vitest";

import { outlinesOf } from "./outline-boxes";

const element = (
  key: string,
  parentKey: string | null,
  children: string[],
): Element => ({
  key,
  name: key,
  parentKey,
  depth: parentKey === null ? 0 : 1,
  children,
  tags: [key],
  parameters: {},
});

const elements: Element[] = [
  element("root", null, ["a", "b", "c"]),
  element("a", "root", []),
  element("b", "root", []),
  element("c", "root", []),
];

const shapes: PlacedShape[] = [
  { key: "a", x: -1, y: 0, width: 1, height: 1 },
  { key: "b", x: 0, y: 0, width: 1, height: 1 },
  { key: "c", x: 0, y: 1, width: 1, height: 1 },
];

describe("outlinesOf", () => {
  it("strokes a single shape and boxes a subtree of several", () => {
    const { single, boxes } = outlinesOf(shapes, elements, ["b"], 0.1);
    expect([...single]).toEqual(["b"]);
    expect(boxes).toEqual([]);
    const whole = outlinesOf(shapes, elements, ["root"], 0.1);
    expect([...whole.single]).toEqual([]);
    expect(whole.boxes).toEqual([{ x: -0.5, y: 0.5, width: 2.2, height: 2.2 }]);
  });

  it("ignores keys that draw nothing", () => {
    const { single, boxes } = outlinesOf(shapes, elements, ["nope"], 0.1);
    expect(single.size).toBe(0);
    expect(boxes).toEqual([]);
  });
});
