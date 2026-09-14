import { describe, expect, it } from "vitest";

import {
  DEFAULT_CAMERA,
  pan,
  toCanvas,
  toStage,
  viewBox,
  zoomAt,
} from "./camera";

const size = { width: 800, height: 600 };

describe("camera", () => {
  it("maps the canvas centre to the camera point with y up", () => {
    expect(toStage(DEFAULT_CAMERA, size, 400, 300)).toEqual({ x: 0, y: 0.75 });
    expect(toStage(DEFAULT_CAMERA, size, 520, 300).x).toBeCloseTo(1);
    expect(toStage(DEFAULT_CAMERA, size, 400, 180).y).toBeCloseTo(1.75);
    const back = toCanvas(DEFAULT_CAMERA, size, 1, 1.75);
    expect(back.px).toBeCloseTo(520);
    expect(back.py).toBeCloseTo(180);
  });

  it("pans so the stage follows the pointer", () => {
    const moved = pan(DEFAULT_CAMERA, 120, -60);
    expect(moved.x).toBeCloseTo(-1);
    expect(moved.y).toBeCloseTo(0.25);
  });

  it("zooms around the pointer and clamps the scale", () => {
    const zoomed = zoomAt(DEFAULT_CAMERA, size, 520, 300, 2);
    expect(zoomed.scale).toBe(240);
    expect(toStage(zoomed, size, 520, 300).x).toBeCloseTo(1);
    expect(zoomAt(DEFAULT_CAMERA, size, 0, 0, 1_000).scale).toBe(2_000);
    expect(zoomAt(DEFAULT_CAMERA, size, 0, 0, 0.0001).scale).toBe(10);
  });

  it("writes a viewBox in metres with y flipped", () => {
    expect(viewBox({ x: 0, y: 0, scale: 100 }, size)).toBe("-4 -3 8 6");
  });
});
