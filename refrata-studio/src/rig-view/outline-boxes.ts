import { subtreeOf, type Element, type PlacedShape } from "@refrata/core";

/** A rectangle around several shapes, stage metres, centre-based like a PlacedShape. */
export interface OutlineBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Outlines {
  /** Shape keys to stroke on their own: keys whose subtree draws as one shape. */
  readonly single: ReadonlySet<string>;
  /** One box per key whose subtree draws as several shapes, around all of them. */
  readonly boxes: readonly OutlineBox[];
}

/**
 * How picked or outlined Element keys are drawn over a Fixture's shapes: a
 * key that is one shape strokes that shape; a key covering several (the
 * root of a multi-Element Fixture, a bar of sections) gets one box around
 * them, padded by `pad`, so a whole Fixture reads as one thing.
 */
export function outlinesOf(
  shapes: readonly PlacedShape[],
  elements: readonly Element[],
  keys: readonly string[],
  pad: number,
): Outlines {
  const single = new Set<string>();
  const boxes: OutlineBox[] = [];
  const byKey = new Map(shapes.map((shape) => [shape.key, shape]));
  for (const key of new Set(keys)) {
    const covered = subtreeOf(elements, key)
      .map((element) => byKey.get(element.key))
      .filter((shape): shape is PlacedShape => shape !== undefined);
    if (covered.length === 0) continue;
    if (covered.length === 1) {
      single.add(covered[0]?.key ?? key);
      continue;
    }
    const left = Math.min(...covered.map((shape) => shape.x - shape.width / 2));
    const right = Math.max(
      ...covered.map((shape) => shape.x + shape.width / 2),
    );
    const bottom = Math.min(
      ...covered.map((shape) => shape.y - shape.height / 2),
    );
    const top = Math.max(...covered.map((shape) => shape.y + shape.height / 2));
    boxes.push({
      x: (left + right) / 2,
      y: (bottom + top) / 2,
      width: right - left + pad * 2,
      height: top - bottom + pad * 2,
    });
  }
  return { single, boxes };
}
