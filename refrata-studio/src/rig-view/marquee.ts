import {
  allFixtures,
  elementsOf,
  placeShape,
  type Fixture,
  type PlacedShape,
  type Position,
  type StoredFixtureType,
  type Table,
} from "@refrata/core";

/**
 * Marquee hit-testing, in stage metres: a placed Element is inside when its
 * shape's centre, rotated with its Fixture and offset to the Fixture's
 * Position, lies in the rectangle. When every placed shape of a Fixture is
 * inside, the Fixture's root stands for them all, so a box around three
 * strobes picks three Fixtures and a box around three panels picks panels.
 */
export interface Rect {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface PlacedFixture {
  readonly id: string;
  readonly position: Position;
  readonly shapes: readonly PlacedShape[];
}

/** Every Fixture with its placed shapes, in stage-relative metres. */
export function placedFixtures(
  fixtures: Table<Fixture>,
  types: Table<StoredFixtureType>,
): PlacedFixture[] {
  return allFixtures(fixtures).map((fixture) => {
    const mode = types[fixture.typeKey]?.type.modes[fixture.modeKey];
    return {
      id: fixture.id,
      position: fixture.position,
      shapes:
        mode === undefined ? [] : placeShape(mode.shape, elementsOf(mode)),
    };
  });
}

export function normalizeRect(rect: Rect): Rect {
  return {
    x1: Math.min(rect.x1, rect.x2),
    y1: Math.min(rect.y1, rect.y2),
    x2: Math.max(rect.x1, rect.x2),
    y2: Math.max(rect.y1, rect.y2),
  };
}

/** A shape centre in stage space: the Fixture's rotation about z, then its Position. */
export function shapeCentre(
  position: Position,
  shape: PlacedShape,
): { readonly x: number; readonly y: number } {
  const angle = (position.rz * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: position.x + shape.x * cos - shape.y * sin,
    y: position.y + shape.x * sin + shape.y * cos,
  };
}

/**
 * The stage rectangle around every placed shape, corners rotated with their
 * Fixture; a Fixture with no shapes counts as its Position. Undefined for an
 * empty rig.
 */
export function rigBounds(
  fixtures: readonly PlacedFixture[],
): Rect | undefined {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const fixture of fixtures) {
    if (fixture.shapes.length === 0) {
      xs.push(fixture.position.x);
      ys.push(fixture.position.y);
    }
    for (const shape of fixture.shapes) {
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        const corner = shapeCentre(fixture.position, {
          ...shape,
          x: shape.x + (dx * shape.width) / 2,
          y: shape.y + (dy * shape.height) / 2,
        });
        xs.push(corner.x);
        ys.push(corner.y);
      }
    }
  }
  if (xs.length === 0) return undefined;
  return {
    x1: Math.min(...xs),
    y1: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  };
}

/** The Element refs inside `rect`, Fixture by Fixture in the order given, shapes in tree order. */
export function elementsInRect(
  fixtures: readonly PlacedFixture[],
  rect: Rect,
): string[] {
  const box = normalizeRect(rect);
  const inside = (x: number, y: number): boolean =>
    x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2;
  const picked: string[] = [];
  for (const fixture of fixtures) {
    const hit = fixture.shapes.filter((shape) => {
      const centre = shapeCentre(fixture.position, shape);
      return inside(centre.x, centre.y);
    });
    if (hit.length === 0) continue;
    if (hit.length === fixture.shapes.length) picked.push(`${fixture.id}/root`);
    else for (const shape of hit) picked.push(`${fixture.id}/${shape.key}`);
  }
  return picked;
}

export { placeShape };
