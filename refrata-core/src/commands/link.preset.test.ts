import { describe, expect, it } from "vitest";

import { presetRowValues } from "../composition/preset-entries.ts";
import { resolveDocument } from "../composition/resolve.ts";
import type { LookLayer } from "../document/composition.ts";
import type { Document } from "../document/document.ts";
import { applyPatches } from "../document/patch.ts";
import type { ValuePreset } from "../document/preset.ts";
import { refused, run, withTable } from "./preset-stage.ts";

const AIM = ["layer/spot/row/all/pan", "layer/spot/row/all/tilt"];

function linked(): Document {
  return run(withTable(), "link.preset", {
    presetId: "table",
    addresses: AIM,
  }).document;
}

function aimOf(document: Document, ref: string): readonly unknown[] {
  const values = resolveDocument(document).get(ref);
  return [values?.pan, values?.tilt];
}

describe("link.preset", () => {
  it("sends each Element the row reaches to its own entry", () => {
    const result = run(withTable(), "link.preset", {
      presetId: "table",
      addresses: AIM,
    });
    expect(result.label).toBe("Link 2 Parameters to Table");
    expect(Object.values(result.document.links)).toMatchObject([
      { presetId: "table", address: AIM[0] },
      { presetId: "table", address: AIM[1] },
    ]);
    expect(aimOf(result.document, "left/root")).toEqual([10, 20]);
    expect(aimOf(result.document, "right/root")).toEqual([-30, 40]);
  });

  it("releases an Element the Preset has nothing for, and gives it the All Elements row when there is one", () => {
    let document = run(linked(), "preset.elements.remove", {
      presetId: "table",
      refs: ["right/root"],
    }).document;
    expect(aimOf(document, "left/root")).toEqual([10, 20]);
    expect(aimOf(document, "right/root")).toEqual([0, 0]);
    const spot = document.layers.spot as LookLayer;
    const table = document.presets.table as ValuePreset;
    expect(presetRowValues(document, spot, "all", "pan", table)).toEqual([
      { ref: "left/root", label: "Left", value: 10 },
      { ref: "right/root", label: "Right", value: undefined },
    ]);
    document = run(document, "preset.row.set", {
      presetId: "table",
      elements: ["all"],
      attribute: "pan",
      value: 45,
    }).document;
    expect(aimOf(document, "right/root")).toEqual([45, 0]);
  });

  it("lets a Target's own row override the linked All Targets row", () => {
    let document = run(linked(), "layer.targets.add", {
      layerId: "spot",
      targets: ["right/root"],
    }).document;
    document = run(document, "layer.row.set", {
      layerId: "spot",
      targets: ["right/root"],
      attribute: "pan",
      value: 99,
    }).document;
    expect(aimOf(document, "left/root")).toEqual([10, 20]);
    expect(aimOf(document, "right/root")).toEqual([99, 40]);
  });

  it("follows a Controller that drives a Preset row", () => {
    let document = run(linked(), "controller.create", {
      id: "sweep",
      kind: "number",
      addresses: ["preset/table/row/left/root/pan"],
    }).document;
    document = run(document, "address.set", {
      address: "controller/sweep/value",
      value: 1,
    }).document;
    expect(aimOf(document, "left/root")).toEqual([270, 20]);
  });

  it("refuses hand edits of a linked row and any Address that is not a Look Layer row", () => {
    const document = linked();
    expect(
      refused(document, "aim.edit", {
        pan: AIM[0],
        tilt: AIM[1],
        value: { pan: 5 },
      }),
    ).toBe("Pan is controlled by Preset “Table”.");
    expect(
      refused(document, "link.preset", {
        presetId: "table",
        addresses: ["layer/spot/opacity"],
      }),
    ).toBe(
      "“Opacity” holds one value; a Preset holds one per Element and links only to a Look Layer row.",
    );
    expect(
      refused(document, "link.preset", {
        presetId: "table",
        addresses: ["preset/table/row/all/pan"],
      }),
    ).toMatch(/links only to a Look Layer row/);
  });

  it("moves a row from its Controller to the Preset, and unlinks back to what was authored", () => {
    let document = run(withTable(), "layer.row.set", {
      layerId: "spot",
      targets: ["all"],
      attribute: "pan",
      value: 7,
    }).document;
    document = run(document, "controller.create", {
      id: "sweep",
      kind: "number",
      addresses: [AIM[0]],
    }).document;
    document = run(document, "link.preset", {
      presetId: "table",
      addresses: [AIM[0]],
    }).document;
    const [link] = Object.values(document.links);
    expect(Object.values(document.links)).toHaveLength(1);
    expect(aimOf(document, "left/root")[0]).toBe(10);
    document = run(document, "link.remove", { linkId: link?.id }).document;
    expect(aimOf(document, "left/root")[0]).toBe(7);
  });

  it("grows a Preset out of rows, leaving the rig as it is", () => {
    let document = run(withTable(), "layer.aim.set", {
      layerId: "spot",
      targets: ["all"],
    }).document;
    document = run(document, "aim.edit", {
      pan: AIM[0],
      tilt: AIM[1],
      value: { pan: 33, tilt: -12 },
    }).document;
    const grown = run(document, "preset.create", {
      id: "wall",
      name: "Wall",
      addresses: AIM,
    });
    expect(grown.document.presets.wall).toMatchObject({
      elements: ["left/root", "right/root"],
      rows: {
        "left/root": { pan: { value: 33 }, tilt: { value: -12 } },
        "right/root": { pan: { value: 33 }, tilt: { value: -12 } },
      },
    });
    expect(aimOf(grown.document, "right/root")).toEqual([33, -12]);
    expect(applyPatches(grown.document, grown.inverse)).toEqual(document);
  });

  it("releases the rows it drove when the Preset goes, as one step that undo restores", () => {
    const document = run(linked(), "layer.row.set", {
      layerId: "spot",
      targets: ["all"],
      attribute: "tilt",
      alpha: 1,
    }).document;
    const removed = run(document, "preset.remove", { presetId: "table" });
    expect(removed.warnings).toEqual([
      "Released the rows linked to it on “Spot”",
      "Removed 2 Links",
    ]);
    expect(removed.document.links).toEqual({});
    expect(removed.document.layers.spot).toMatchObject({ all: {} });
    expect(aimOf(removed.document, "left/root")).toEqual([0, 0]);
    const undone = applyPatches(removed.document, removed.inverse);
    expect(undone).toEqual(document);
    expect(aimOf(undone, "right/root")).toEqual([-30, 40]);
  });

  it("unlinks an Aim as one step", () => {
    const document = linked();
    const unlinked = run(document, "aim.unlink", {
      pan: AIM[0],
      tilt: AIM[1],
    });
    expect(unlinked.label).toBe("Unlink Aim");
    expect(unlinked.document.links).toEqual({});
    expect(applyPatches(unlinked.document, unlinked.inverse)).toEqual(document);
  });

  it("keeps the Links of a duplicated Layer on the Preset", () => {
    const document = run(linked(), "layer.duplicate", {
      layerId: "spot",
      id: "copy",
    }).document;
    expect(Object.values(document.links).map((link) => link.address)).toContain(
      "layer/copy/row/all/pan",
    );
  });
});
