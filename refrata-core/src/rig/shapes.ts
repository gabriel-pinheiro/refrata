import { settings } from "../settings.ts";
import type { Element } from "./elements.ts";
import type { Shape } from "./fixture-type.ts";

/**
 * Shape Templates: where each placed Element is drawn relative to its
 * Fixture's Position, in metres, schematic and not to scale. Elements a
 * template does not place are not drawn. Studio draws these; core owns them
 * so placement of a new Fixture can measure a shape.
 */
export interface PlacedShape {
  readonly key: string;
  /** Centre offset from the Fixture's Position, metres, `y` up. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const cell = (): number => settings.rigView.cellMetres;

/** Elements carrying `tag`, in tree order. */
function tagged(elements: readonly Element[], tag: string): readonly Element[] {
  return elements.filter((element) => element.tags.includes(tag));
}

function row(keys: readonly string[], y: number, size: number): PlacedShape[] {
  const width = keys.length * size;
  return keys.map((key, index) => ({
    key,
    x: -width / 2 + size * (index + 0.5),
    y,
    width: size,
    height: size,
  }));
}

export function placeShape(
  shape: Shape,
  elements: readonly Element[],
): readonly PlacedShape[] {
  const size = cell();
  switch (shape.template) {
    case "single":
      return [
        { key: "root", x: 0, y: size, width: size * 2, height: size * 2 },
      ];
    case "bar":
      return row(
        tagged(elements, shape.tag)
          .slice(0, shape.count)
          .map((element) => element.key),
        size / 2,
        size,
      );
    case "grid": {
      const keys = tagged(elements, shape.tag).map((element) => element.key);
      const result: PlacedShape[] = [];
      const width = shape.cols * size;
      const height = shape.rows * size;
      for (
        let index = 0;
        index < Math.min(keys.length, shape.cols * shape.rows);
        index += 1
      ) {
        const col = index % shape.cols;
        const rowIndex = Math.floor(index / shape.cols);
        result.push({
          key: keys[index] ?? "",
          x: -width / 2 + size * (col + 0.5),
          y: height - size * (rowIndex + 0.5),
          width: size,
          height: size,
        });
      }
      return result;
    }
    case "strobe-backlight": {
      // As the real fixture: the first half of the panels below, the
      // sections in one line across the middle, the other half above.
      const sections = tagged(elements, "section")
        .slice(0, shape.sections)
        .map((element) => element.key);
      const panels = tagged(elements, "panel")
        .slice(0, shape.panels)
        .map((element) => element.key);
      const below = panels.slice(0, Math.ceil(panels.length / 2));
      const above = panels.slice(below.length);
      const width = Math.max(above.length, below.length, 1) * size;
      const sectionWidth = width / Math.max(1, sections.length);
      const sectionHeight = size / 2;
      return [
        ...row(above, size + sectionHeight + size / 2, size),
        ...sections.map((key, index) => ({
          key,
          x: -width / 2 + sectionWidth * (index + 0.5),
          y: size + sectionHeight / 2,
          width: sectionWidth,
          height: sectionHeight,
        })),
        ...row(below, size / 2, size),
      ];
    }
  }
}

/** The overall width of a shape, metres, for placing the next Fixture beside it. */
export function shapeWidth(placed: readonly PlacedShape[]): number {
  if (placed.length === 0) return cell() * 2;
  const left = Math.min(...placed.map((shape) => shape.x - shape.width / 2));
  const right = Math.max(...placed.map((shape) => shape.x + shape.width / 2));
  return right - left;
}
