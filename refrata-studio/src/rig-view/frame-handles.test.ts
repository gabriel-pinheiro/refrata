import { describe, expect, it } from "vitest";

import { dragFrame, handleCursor, isFrameHandle } from "./frame-handles";

const frame = { x: 1, y: 1, width: 2, height: 1, rotation: 0 };

describe("dragging a Frame", () => {
  it("moves the body by the pointer's travel", () => {
    expect(
      dragFrame(frame, "move", { x: 0, y: 0 }, { x: 0.5, y: -0.25 }),
    ).toEqual({ ...frame, x: 1.5, y: 0.75 });
  });

  it("moves an edge and keeps the opposite one still", () => {
    // The right edge at x 2 dragged to x 3: a metre wider, centre half a metre right.
    expect(dragFrame(frame, "e", { x: 2, y: 1 }, { x: 3, y: 1 })).toEqual({
      ...frame,
      x: 1.5,
      width: 3,
    });
    // The bottom edge at y 0.5 dragged up past the top stops a cell short of
    // it; the centre is kept to centimetres.
    expect(dragFrame(frame, "s", { x: 1, y: 0.5 }, { x: 1, y: 9 })).toEqual({
      ...frame,
      y: 1.38,
      height: 0.25,
    });
  });

  it("moves a corner along both axes, in the Frame's own directions when turned", () => {
    expect(dragFrame(frame, "ne", { x: 2, y: 1.5 }, { x: 3, y: 2.5 })).toEqual({
      ...frame,
      x: 1.5,
      y: 1.5,
      width: 3,
      height: 2,
    });
    // Turned 90°, the Frame's east edge points up on stage: dragging it up widens the Frame.
    const turned = { ...frame, rotation: 90 };
    const wider = dragFrame(turned, "e", { x: 1, y: 2 }, { x: 1, y: 3 });
    expect(wider.width).toBe(3);
    expect(wider.height).toBe(1);
    expect(wider.y).toBe(1.5);
    expect(wider.x).toBe(1);
  });

  it("turns about the centre by the pointer's angle, in tenths of a degree", () => {
    const turned = dragFrame(frame, "rotate", { x: 2, y: 1 }, { x: 1, y: 2 });
    expect(turned).toEqual({ ...frame, rotation: 90 });
    expect(
      dragFrame(turned, "rotate", { x: 1, y: 2 }, { x: 1.03, y: 2 }).rotation,
    ).toBeCloseTo(88.3, 1);
  });

  it("names the cursor a handle shows once the Frame is turned", () => {
    expect(handleCursor("e", 0)).toBe("ew-resize");
    expect(handleCursor("e", 90)).toBe("ns-resize");
    expect(handleCursor("ne", 0)).toBe("nesw-resize");
    expect(handleCursor("ne", 90)).toBe("nwse-resize");
    expect(handleCursor("rotate", 0)).toBe("grab");
    expect(isFrameHandle("sw")).toBe(true);
    expect(isFrameHandle("x")).toBe(false);
  });
});
