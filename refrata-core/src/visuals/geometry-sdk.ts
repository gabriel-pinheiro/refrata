import type { ParameterValues } from "../parameters.ts";
import type {
  Emit,
  FigurePath,
  FrameSize,
  GeometryInput,
  GeometryTarget,
  Pose,
  VisualContext,
  VisualDefinition,
  VisualInstance,
} from "./sdk.ts";

/**
 * How a Geometry Visual is written: like any Visual, but its instance is
 * handed each Target's point in the Layer's Frame (metres from the centre,
 * `x` along the width, `y` along the height) with the Frame's size, and
 * it reports a pose the definition's `figure` draws. Its Parameters are
 * fractions of the Frame, so a band "20 % wide" reads the same on a
 * measured rig and a schematic one. On a Layer without a Frame it releases
 * everything. Reasoned in docs/geometry-visuals.md.
 */
export interface GeometryFrame extends GeometryInput {
  readonly dt: number;
  readonly params: ParameterValues;
}

export interface GeometryInstance {
  update(frame: GeometryFrame, emit: Emit): void;
  pose(): Pose;
  cue?(key: string): void;
  dispose?(): void;
}

export type GeometryVisualDefinition = Omit<
  VisualDefinition,
  "create" | "geometry"
> & {
  /** Function properties, not methods: the wrapper takes them off the definition. */
  readonly figure: (
    params: ParameterValues,
    pose: Pose,
    size: FrameSize,
  ) => readonly FigurePath[];
  readonly create: (context: VisualContext) => GeometryInstance;
};

export function defineGeometryVisual(
  definition: GeometryVisualDefinition,
): VisualDefinition {
  const { figure, create, ...rest } = definition;
  return {
    ...rest,
    geometry: { figure },
    create(context) {
      const instance = create(context);
      const wrapped: VisualInstance = {
        update(frame, emit) {
          if (frame.geometry === undefined) return;
          instance.update(
            { dt: frame.dt, params: frame.params, ...frame.geometry },
            emit,
          );
        },
        pose: () => instance.pose(),
      };
      if (instance.cue !== undefined)
        wrapped.cue = (key) => instance.cue?.(key);
      if (instance.dispose !== undefined)
        wrapped.dispose = () => instance.dispose?.();
      return wrapped;
    },
  };
}

/**
 * An envelope's level at `distance` from its centre line: 1 inside the
 * band's hard core, 0 past its half width, a straight ramp between, the
 * core being the band less `softness` of it on each side.
 */
export function bandLevel(
  distance: number,
  halfWidth: number,
  softness: number,
): number {
  if (halfWidth <= 0) return 0;
  const inner = halfWidth * (1 - softness);
  if (distance <= inner) return 1;
  if (distance >= halfWidth) return 0;
  return (halfWidth - distance) / (halfWidth - inner);
}

/** Whether a Target's point lies inside the Frame. */
export function insideFrame(target: GeometryTarget, size: FrameSize): boolean {
  return (
    Math.abs(target.x) <= size.width / 2 &&
    Math.abs(target.y) <= size.height / 2
  );
}

/** Half the Frame's diagonal: the farthest a point inside it is from the centre. */
export function halfDiagonal(size: FrameSize): number {
  return Math.hypot(size.width, size.height) / 2;
}

/** A rectangle path in Frame space, from its centre and size. */
export function rectPath(
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const left = x - width / 2;
  const bottom = y - height / 2;
  return `M ${n(left)} ${n(bottom)} h ${n(width)} v ${n(height)} h ${n(-width)} Z`;
}

/** A full circle path about the Frame's centre, two arcs. */
export function circlePath(radius: number): string {
  const r = n(radius);
  return `M ${n(-radius)} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${n(-radius)} 0 Z`;
}

/** A wedge from the centre, `from` to `to` degrees counterclockwise from the right, at `radius`. */
export function wedgePath(from: number, to: number, radius: number): string {
  const start = polar(from, radius);
  const end = polar(to, radius);
  const large = (((to - from) % 360) + 360) % 360 > 180 ? 1 : 0;
  return `M 0 0 L ${n(start.x)} ${n(start.y)} A ${n(radius)} ${n(radius)} 0 ${String(large)} 1 ${n(end.x)} ${n(end.y)} Z`;
}

function polar(degrees: number, radius: number): { x: number; y: number } {
  const angle = (degrees * Math.PI) / 180;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** Path numbers to millimetres, so a figure is short on the wire. */
function n(value: number): string {
  return String(Math.round(value * 1_000) / 1_000);
}
