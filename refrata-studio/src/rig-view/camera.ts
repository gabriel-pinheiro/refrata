/**
 * The Rig View's camera: where stage space sits on the canvas. `x` and `y`
 * are the stage point at the canvas centre, in metres; `scale` is pixels per
 * metre. Stage `y` runs up, canvas `y` runs down, so the view flips it.
 * Pure functions, so pan and zoom are tested without a browser.
 */
export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export const DEFAULT_CAMERA: Camera = { x: 0, y: 0.75, scale: 120 };
export const MIN_SCALE = 10;
export const MAX_SCALE = 2_000;

export interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

/** Canvas pixels to stage metres. */
export function toStage(
  camera: Camera,
  size: CanvasSize,
  px: number,
  py: number,
): { readonly x: number; readonly y: number } {
  return {
    x: camera.x + (px - size.width / 2) / camera.scale,
    y: camera.y - (py - size.height / 2) / camera.scale,
  };
}

/** Stage metres to canvas pixels. */
export function toCanvas(
  camera: Camera,
  size: CanvasSize,
  x: number,
  y: number,
): { readonly px: number; readonly py: number } {
  return {
    px: size.width / 2 + (x - camera.x) * camera.scale,
    py: size.height / 2 - (y - camera.y) * camera.scale,
  };
}

/** Moves the camera by a pixel delta so the stage follows the pointer. */
export function pan(camera: Camera, dx: number, dy: number): Camera {
  return {
    ...camera,
    x: camera.x - dx / camera.scale,
    y: camera.y + dy / camera.scale,
  };
}

/** Zooms by `factor` keeping the stage point under the pixel (px, py) still. */
export function zoomAt(
  camera: Camera,
  size: CanvasSize,
  px: number,
  py: number,
  factor: number,
): Camera {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * factor));
  if (scale === camera.scale) return camera;
  const before = toStage(camera, size, px, py);
  const zoomed = { ...camera, scale };
  const after = toStage(zoomed, size, px, py);
  return {
    x: zoomed.x + before.x - after.x,
    y: zoomed.y + before.y - after.y,
    scale,
  };
}

/** The SVG `viewBox` for a camera: stage metres, `y` already flipped by the view's transform. */
export function viewBox(camera: Camera, size: CanvasSize): string {
  const width = size.width / camera.scale;
  const height = size.height / camera.scale;
  return `${String(camera.x - width / 2)} ${String(-camera.y - height / 2)} ${String(width)} ${String(height)}`;
}
