import { describe, expect, it } from "vitest";

import { linkTarget } from "../address/links.ts";
import {
  regionFlags,
  regionPresetValues,
} from "../composition/region-reach.ts";
import type { ValuePreset } from "../document/preset.ts";
import { refused, run, withTable } from "./preset-stage.ts";
import { lands, moved, withCorners, withLayer } from "./region-stage.ts";

describe("a Region linked to Presets", () => {
  it("flies each mover inside its own box, one of them the other way", () => {
    const document = withCorners();
    expect(lands(document, "left/root", 0, 0)).toEqual([10, 20]);
    expect(lands(document, "left/root", 1, 1)).toEqual([50, 80]);
    expect(lands(document, "right/root", 0, 0)).toEqual([-30, 40]);
    expect(lands(document, "right/root", 0.5, 0.5)).toEqual([-50, -10]);
    expect(linkTarget(document, "layer/move/region/to/pan")).toEqual({
      label: "To Pan",
      owner: "Move · Region",
      layerId: "move",
    });
    expect(
      regionPresetValues(
        document,
        moved(document),
        "tilt",
        document.presets.wall as ValuePreset,
      ),
    ).toEqual([
      { ref: "left/root", label: "Left", value: 80 },
      { ref: "right/root", label: "Right", value: -60 },
    ]);
  });

  it("releases a mover a Preset has nothing for, and refuses a hand edit of a linked Aim", () => {
    const document = run(withCorners(), "preset.elements.remove", {
      presetId: "wall",
      refs: ["right/root"],
    }).document;
    expect(lands(document, "left/root", 1, 1)).toEqual([50, 80]);
    expect(lands(document, "right/root", 1, 1)).toEqual([undefined, undefined]);
    expect(
      refused(document, "layer.region.set", {
        layerId: "move",
        to: { pan: 3 },
      }),
    ).toBe("To Pan is controlled by Preset “Wall”.");
  });

  it("refuses Add while an Aim is linked, and an Aim the form lacks", () => {
    const document = withCorners();
    expect(
      refused(document, "layer.update", { layerId: "move", blendMode: "add" }),
    ).toBe(
      "The Region of “Move” is linked to Preset “Table”, which holds places; on Add a Region is an offset from what is below. Unlink its Aims first.",
    );
    expect(
      refused(document, "link.preset", {
        presetId: "table",
        addresses: ["layer/move/region/center/pan"],
      }),
    ).toBe("The Region of “Move” is by corners; it has no Center.");
    expect(
      refused(withLayer("figure", withTable()), "link.preset", {
        presetId: "table",
        addresses: ["layer/move/region/center/pan"],
      }),
    ).toBe(
      "On Add the Region of “Move” is an offset from what is below, and a Preset holds places. Link the Look Layer below to the Preset instead.",
    );
  });

  it("turns typed corners into center and size when the Layer goes to Add", () => {
    const document = run(withLayer("flyout"), "layer.update", {
      layerId: "move",
      blendMode: "add",
    }).document;
    expect(moved(document).region).toEqual({
      form: "center",
      center: { pan: 0, tilt: 15 },
      width: 60,
      height: 90,
    });
  });

  it("goes back to the typed Aims when its Preset is removed, and takes the Links of Aims a new form lacks", () => {
    const removed = run(withCorners(), "preset.remove", { presetId: "wall" });
    expect(removed.warnings).toContain(
      "The Region of “Move” went back to the Aims typed under it",
    );
    expect(lands(removed.document, "left/root", 1, 1)).toEqual([30, 60]);
    const changed = run(withCorners(), "layer.region.set", {
      layerId: "move",
      form: "center",
    });
    expect(changed.document.links).toEqual({});
    expect(changed.warnings).toEqual([
      "Removed 4 Links of the Aims it no longer has",
    ]);
  });

  it("grows a Preset out of an Aim, holding what each mover shows", () => {
    const document = run(withLayer("flyout"), "preset.create", {
      id: "start",
      addresses: ["layer/move/region/from/pan", "layer/move/region/from/tilt"],
    }).document;
    expect(document.presets.start).toMatchObject({
      name: "Preset 1",
      elements: ["left/root", "right/root"],
      rows: {
        "left/root": { pan: { value: -30 }, tilt: { value: -30 } },
        "right/root": { pan: { value: -30 }, tilt: { value: -30 } },
      },
    });
    expect(Object.values(document.links)).toHaveLength(2);
  });

  it("flags the ends a mover cannot go to", () => {
    const document = run(withLayer("flyout"), "layer.region.set", {
      layerId: "move",
      form: "center",
      center: { pan: 0, tilt: 80 },
      height: 40,
    }).document;
    const layer = moved(document);
    expect(
      layer.region === undefined
        ? []
        : regionFlags(document, layer, layer.region),
    ).toEqual([
      {
        ref: "left/root",
        label: "Left",
        axis: "tilt",
        value: 100,
        min: -90,
        max: 90,
      },
      {
        ref: "right/root",
        label: "Right",
        axis: "tilt",
        value: 100,
        min: -90,
        max: 90,
      },
    ]);
  });
});
