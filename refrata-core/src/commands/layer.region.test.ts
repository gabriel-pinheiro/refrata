import { describe, expect, it } from "vitest";

import { refused, run } from "./preset-stage.ts";
import { lands, moved, withCorners, withLayer } from "./region-stage.ts";

describe("layer.region.set", () => {
  it("starts a Layer with the Region its Visual declares, in place of two bindings", () => {
    const flyout = moved(withLayer("flyout"));
    expect(flyout.region).toEqual({
      form: "corners",
      from: { pan: -30, tilt: -30 },
      to: { pan: 30, tilt: 60 },
    });
    expect(Object.keys(flyout.bindings)).toEqual(["level"]);
    const figure = moved(withLayer("figure"));
    expect(figure.blendMode).toBe("add");
    expect(figure.region).toMatchObject({ form: "center", width: 30 });
    expect(figure.bindings).toEqual({});
  });

  it("sets the fields given, holds an Aim to what the movers reach and says so", () => {
    const result = run(withLayer("flyout"), "layer.region.set", {
      layerId: "move",
      from: { pan: 10 },
      to: { tilt: 120 },
    });
    expect(result.label).toBe("Set Region");
    expect(moved(result.document).region).toEqual({
      form: "corners",
      from: { pan: 10, tilt: -30 },
      to: { pan: 30, tilt: 90 },
    });
    expect(result.warnings).toEqual([
      "To Tilt clamped to 90.0° from 120.0°: the Elements it reaches go no further.",
    ]);
  });

  it("writes the same box the other way when the form changes", () => {
    const document = run(withLayer("flyout"), "layer.region.set", {
      layerId: "move",
      form: "center",
      width: 40,
    }).document;
    expect(moved(document).region).toEqual({
      form: "center",
      center: { pan: 0, tilt: 15 },
      width: 40,
      height: 90,
    });
    expect(
      refused(document, "layer.region.set", {
        layerId: "move",
        from: { pan: 1 },
      }),
    ).toBe(
      "The Region of “Move” is by center and size; it has no From. Give the form to change it.",
    );
  });

  it("refuses a Visual that draws in no Region, and corners on Add", () => {
    expect(
      refused(withLayer("lfo"), "layer.region.set", {
        layerId: "move",
        width: 10,
      }),
    ).toBe("Move runs LFO, which does not draw inside a Region.");
    expect(
      refused(withLayer("figure"), "layer.region.set", {
        layerId: "move",
        form: "corners",
      }),
    ).toBe(
      "“Move” is on Add, where a Region is an offset and a size. Corners are places: use center and size, or another Blend Mode.",
    );
  });

  it("maps what the Visual writes into the box, turned in aim space", () => {
    let document = run(withLayer("flyout"), "layer.region.set", {
      layerId: "move",
      from: { pan: -20, tilt: 80 },
      to: { pan: 20, tilt: 0 },
    }).document;
    expect(lands(document, "left/root", 0, 0)).toEqual([-20, 80]);
    expect(lands(document, "right/root", 1, 0.25)).toEqual([20, 60]);
    document = run(withLayer("figure"), "layer.region.set", {
      layerId: "move",
      center: { pan: 5, tilt: -10 },
      width: 60,
      height: 20,
    }).document;
    // On Add the center is an offset, and what is written is added to what is below.
    expect(lands(document, "left/root", 1, 0.5)).toEqual([35, -10]);
    document = run(document, "address.edit", {
      address: "layer/move/param/rotation",
      value: 90,
    }).document;
    const [pan, tilt] = lands(document, "left/root", 1, 0.5);
    expect(pan).toBeCloseTo(5);
    expect(tilt).toBeCloseTo(20);
  });
});

describe("layer.region.remove", () => {
  it("sends the two Slots back to their bindings and takes the Links", () => {
    const result = run(withCorners(), "layer.region.remove", {
      layerId: "move",
    });
    expect(moved(result.document).region).toBeUndefined();
    expect(moved(result.document).bindings).toMatchObject({
      pan: { attribute: "pan", from: -270, to: 270 },
      tilt: { attribute: "tilt", from: -135, to: 135 },
    });
    expect(result.document.links).toEqual({});
    expect(result.warnings).toEqual(["Removed 4 Links"]);
    expect(
      refused(result.document, "layer.region.remove", { layerId: "move" }),
    ).toBe("“Move” has no Region.");
    const back = run(result.document, "layer.region.set", {
      layerId: "move",
      to: { pan: 40 },
    }).document;
    expect(moved(back).region).toMatchObject({ to: { pan: 40, tilt: 60 } });
    expect(Object.keys(moved(back).bindings)).toEqual(["level"]);
    expect(
      refused(back, "layer.binding.set", {
        layerId: "move",
        slot: "pan",
        attribute: "zoom",
      }),
    ).toBe(
      "Pan runs along the Region of “Move”. Set the Region, or remove it to bind the Slot.",
    );
  });
});
