import {
  fromFrameSpace,
  roundMetres,
  settings,
  toFrameSpace,
  type Frame,
  type StagePoint,
} from "@refrata/core";

/**
 * Dragging a Frame in the Rig View, as pure maths: a handle and two stage
 * points (where the drag started and where the pointer is) give the Frame
 * the drag means. Edges and corners move that side and keep the opposite
 * one still; the body moves the whole Frame; the rotate handle turns it
 * about its centre. Metres are kept to centimetres and degrees to tenths.
 */
export const EDGE_HANDLES = ["n", "s", "e", "w"] as const;
export const CORNER_HANDLES = ["ne", "nw", "se", "sw"] as const;
export type FrameHandle =
  | (typeof EDGE_HANDLES)[number]
  | (typeof CORNER_HANDLES)[number]
  | "rotate"
  | "move";

export function isFrameHandle(value: string | undefined): value is FrameHandle {
  return (
    value === "rotate" ||
    value === "move" ||
    (EDGE_HANDLES as readonly string[]).includes(value ?? "") ||
    (CORNER_HANDLES as readonly string[]).includes(value ?? "")
  );
}

/** Where a resize handle sits in Frame space, as a fraction of the half size along each axis. */
export function handleAnchor(handle: Exclude<FrameHandle, "rotate" | "move">): {
  readonly x: -1 | 0 | 1;
  readonly y: -1 | 0 | 1;
} {
  return {
    x: handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0,
    y: handle.includes("n") ? 1 : handle.includes("s") ? -1 : 0,
  };
}

/** The cursor a handle shows, given the Frame's rotation, so a turned Frame's right edge still reads as horizontal. */
export function handleCursor(handle: FrameHandle, rotation: number): string {
  if (handle === "rotate") return "grab";
  if (handle === "move") return "move";
  const { x, y } = handleAnchor(handle);
  // The handle's direction on screen, degrees counterclockwise from the right.
  const direction =
    ((Math.atan2(y, x) * 180) / Math.PI + rotation + 360 + 22.5) % 360;
  const cursors = [
    "ew-resize",
    "nesw-resize",
    "ns-resize",
    "nwse-resize",
    "ew-resize",
    "nesw-resize",
    "ns-resize",
    "nwse-resize",
  ] as const;
  return cursors[Math.floor(direction / 45)] ?? "move";
}

export function dragFrame(
  start: Frame,
  handle: FrameHandle,
  from: StagePoint,
  to: StagePoint,
): Frame {
  if (handle === "move")
    return {
      ...start,
      x: roundMetres(start.x + to.x - from.x),
      y: roundMetres(start.y + to.y - from.y),
    };
  if (handle === "rotate") {
    const before = Math.atan2(from.y - start.y, from.x - start.x);
    const after = Math.atan2(to.y - start.y, to.x - start.x);
    const turned = start.rotation + ((after - before) * 180) / Math.PI;
    return { ...start, rotation: roundDegrees(((turned % 360) + 360) % 360) };
  }
  const local = toFrameSpace(start, to);
  const anchor = handleAnchor(handle);
  const least = settings.rigView.cellMetres;
  let left = -start.width / 2;
  let right = start.width / 2;
  let bottom = -start.height / 2;
  let top = start.height / 2;
  if (anchor.x === 1) right = Math.max(left + least, local.x);
  if (anchor.x === -1) left = Math.min(right - least, local.x);
  if (anchor.y === 1) top = Math.max(bottom + least, local.y);
  if (anchor.y === -1) bottom = Math.min(top - least, local.y);
  const centre = fromFrameSpace(start, {
    x: (left + right) / 2,
    y: (bottom + top) / 2,
  });
  return {
    x: roundMetres(centre.x),
    y: roundMetres(centre.y),
    width: roundMetres(right - left),
    height: roundMetres(top - bottom),
    rotation: start.rotation,
  };
}

function roundDegrees(value: number): number {
  return Math.round(value * 10) / 10;
}
