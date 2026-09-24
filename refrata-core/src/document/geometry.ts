import { subtreeOf } from "../rig/elements.ts";
import type { GeometryInput, GeometryTarget } from "../visuals/sdk.ts";
import { placeShape, type PlacedShape } from "../rig/shapes.ts";
import { settings } from "../settings.ts";
import type { Frame, VisualLayer } from "./composition.ts";
import { fixtureModeOf } from "./fixtures.ts";
import type { Position } from "./rig.ts";
import type {
  ExpandedTarget,
  LocatedElement,
  TargetSource,
} from "./targets.ts";
import { visualTargets } from "./visual-layers.ts";

/**
 * Where Targets are on stage, for Geometry Visuals and for fitting a Frame.
 * A Target's point is the centre of what it draws in the Rig View: a root
 * is the centre of the whole fixture, a spread bar gives one point per
 * pixel, an unspread Set the centroid of its members. An Element its Shape
 * Template does not place takes its Fixture's Position. Reasoned in
 * docs/geometry-visuals.md.
 */
export interface StagePoint {
  readonly x: number;
  readonly y: number;
}

/** A shape's corner or centre in stage space: rotated about the Fixture's `z`, then moved to its Position. */
function toStage(position: Position, x: number, y: number): StagePoint {
  const angle = (position.rz * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: position.x + x * cos - y * sin,
    y: position.y + x * sin + y * cos,
  };
}

/** The placed shapes of an Element's subtree, in the Fixture's own space. */
function shapesOf(
  document: TargetSource,
  located: LocatedElement,
): readonly PlacedShape[] {
  const mode = fixtureModeOf(document, located.fixture);
  if (mode === undefined) return [];
  const keys = new Set(
    subtreeOf(located.elements, located.element.key).map(
      (element) => element.key,
    ),
  );
  return placeShape(mode.shape, located.elements).filter((shape) =>
    keys.has(shape.key),
  );
}

/** The centre of an Element on stage: the middle of its subtree's shapes, else its Fixture's Position. */
export function elementCentre(
  document: TargetSource,
  located: LocatedElement,
): StagePoint {
  const shapes = shapesOf(document, located);
  if (shapes.length === 0)
    return { x: located.fixture.position.x, y: located.fixture.position.y };
  const left = Math.min(...shapes.map((shape) => shape.x - shape.width / 2));
  const right = Math.max(...shapes.map((shape) => shape.x + shape.width / 2));
  const bottom = Math.min(...shapes.map((shape) => shape.y - shape.height / 2));
  const top = Math.max(...shapes.map((shape) => shape.y + shape.height / 2));
  return toStage(
    located.fixture.position,
    (left + right) / 2,
    (bottom + top) / 2,
  );
}

/** A Target's point on stage: its Element's centre, or the centroid of a Set's members; undefined for a Target with no Elements. */
export function targetCentre(
  document: TargetSource,
  target: ExpandedTarget,
): StagePoint | undefined {
  if (target.elements.length === 0) return undefined;
  let x = 0;
  let y = 0;
  for (const located of target.elements) {
    const centre = elementCentre(document, located);
    x += centre.x;
    y += centre.y;
  }
  return { x: x / target.elements.length, y: y / target.elements.length };
}

/** A Target's point in Frame space: metres from the Frame's centre, `x` along its width and `y` along its height. */
export function toFrameSpace(frame: Frame, point: StagePoint): StagePoint {
  const angle = (-frame.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - frame.x;
  const dy = point.y - frame.y;
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/** A point in Frame space back on stage. */
export function fromFrameSpace(frame: Frame, point: StagePoint): StagePoint {
  const angle = (frame.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: frame.x + point.x * cos - point.y * sin,
    y: frame.y + point.x * sin + point.y * cos,
  };
}

/**
 * What a Geometry Visual is handed for a Layer: its Targets after Spread,
 * each with its point in the Layer's Frame, and the Frame's size; undefined
 * for a Layer without a Frame. A Target with no Elements has no point and
 * is left out.
 */
export function geometryInput(
  document: TargetSource,
  layer: VisualLayer,
): GeometryInput | undefined {
  const frame = layer.frame;
  if (frame === undefined) return undefined;
  const { targets, expanded } = visualTargets(document, layer);
  const placed: GeometryTarget[] = [];
  targets.forEach((target, index) => {
    const expandedTarget = expanded[index];
    if (expandedTarget === undefined) return;
    const centre = targetCentre(document, expandedTarget);
    if (centre === undefined) return;
    placed.push({ ...target, ...toFrameSpace(frame, centre) });
  });
  return { targets: placed, width: frame.width, height: frame.height };
}

/** The stage rectangle around every shape of the Layer's Targets, or undefined when they draw nothing. */
function targetsBounds(
  document: TargetSource,
  layer: VisualLayer,
):
  | {
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
    }
  | undefined {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const target of visualTargets(document, layer).expanded)
    for (const located of target.elements) {
      const shapes = shapesOf(document, located);
      if (shapes.length === 0) {
        xs.push(located.fixture.position.x);
        ys.push(located.fixture.position.y);
      }
      for (const shape of shapes)
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ] as const) {
          const corner = toStage(
            located.fixture.position,
            shape.x + (dx * shape.width) / 2,
            shape.y + (dy * shape.height) / 2,
          );
          xs.push(corner.x);
          ys.push(corner.y);
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

/**
 * The Frame that fits a Layer's Targets: the box around everything they
 * draw, unrotated, never thinner than a cell; a Layer whose Targets draw
 * nothing gets a two-cell square at the origin.
 */
export function frameFittingTargets(
  document: TargetSource,
  layer: VisualLayer,
): Frame {
  const cell = settings.rigView.cellMetres;
  const bounds = targetsBounds(document, layer);
  if (bounds === undefined)
    return { x: 0, y: 0, width: cell * 2, height: cell * 2, rotation: 0 };
  return {
    x: roundMetres((bounds.x1 + bounds.x2) / 2),
    y: roundMetres((bounds.y1 + bounds.y2) / 2),
    width: roundMetres(Math.max(cell, bounds.x2 - bounds.x1)),
    height: roundMetres(Math.max(cell, bounds.y2 - bounds.y1)),
    rotation: 0,
  };
}

/** Frames are kept to centimetres, as Positions are, so a fit does not fill the file with float noise. */
export function roundMetres(value: number): number {
  return Math.round(value * 100) / 100;
}
