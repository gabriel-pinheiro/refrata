import { describe, expect, it } from "vitest";

import { listAddresses, resolveAddress } from "../address/address.ts";
import { addressReach } from "../composition/row-reach.ts";
import { applyPatches } from "../document/patch.ts";
import { flattenPresets } from "../document/presets.ts";
import { refused, run, stage, withTable } from "./preset-stage.ts";

describe("Presets", () => {
  it("creates a Preset listing a Set's members as they are now", () => {
    const created = run(stage(), "preset.create", {
      id: "table",
      name: "Table",
      elements: ["set:movers", "left/root"],
    });
    expect(created.label).toBe("Add Preset");
    expect(created.document.presets.table).toMatchObject({
      kind: "preset",
      elements: ["left/root", "right/root"],
      rows: { "left/root": {}, "right/root": {} },
      all: {},
    });
  });

  it("arranges Presets in Groups, renames, duplicates and ungroups them", () => {
    let document = withTable();
    document = run(document, "preset.create", {
      id: "places",
      kind: "group",
      name: "Places",
    }).document;
    document = run(document, "preset.move", {
      presetId: "table",
      parentId: "places",
      after: null,
    }).document;
    document = run(document, "preset.duplicate", {
      presetId: "table",
      id: "copy",
    }).document;
    expect(document.presets.copy).toMatchObject({
      name: "Table 1",
      parentId: "places",
      rows: { "left/root": { pan: { value: 10 } } },
    });
    document = run(document, "preset.rename", {
      presetId: "copy",
      name: "Wall",
    }).document;
    document = run(document, "preset.ungroup", {
      presetId: "places",
    }).document;
    expect(flattenPresets(document.presets).map((row) => row.name)).toEqual([
      "Table",
      "Wall",
    ]);
  });

  it("refuses Elements and Links on a Group", () => {
    expect(
      refused(stage(), "preset.create", {
        kind: "group",
        elements: ["left/root"],
      }),
    ).toBe("A Group holds Presets, not Elements or Links.");
  });

  it("sets and releases rows of any Attribute, on an Element or All Elements", () => {
    let document = withTable();
    document = run(document, "preset.row.set", {
      presetId: "table",
      elements: ["all"],
      attribute: "dimmer",
    }).document;
    document = run(document, "preset.row.set", {
      presetId: "table",
      elements: ["left/root"],
      attribute: "gobo1",
      value: "line",
    }).document;
    expect(document.presets.table).toMatchObject({
      all: { dimmer: { value: 1 } },
      rows: { "left/root": { gobo1: { value: "line" } } },
    });
    expect(
      refused(document, "preset.row.set", {
        presetId: "table",
        elements: ["left/root"],
        attribute: "tilt",
        value: 100,
      }),
    ).toMatch(/^Tilt /);
    const released = run(document, "preset.row.release", {
      presetId: "table",
      elements: ["left/root"],
      attribute: "gobo1",
    });
    expect(released.document.presets.table).not.toHaveProperty([
      "rows",
      "left/root",
      "gobo1",
    ]);
    expect(applyPatches(released.document, released.inverse)).toEqual(document);
  });

  it("ticks and releases an Aim as one step", () => {
    const document = run(stage(), "preset.create", {
      id: "table",
      elements: ["left/root"],
    }).document;
    const ticked = run(document, "preset.aim.set", {
      presetId: "table",
      elements: ["left/root", "all"],
    });
    expect(ticked.document.presets.table).toMatchObject({
      rows: { "left/root": { pan: { value: 0 }, tilt: { value: 0 } } },
      all: { pan: { value: 0 }, tilt: { value: 0 } },
    });
    expect(applyPatches(ticked.document, ticked.inverse)).toEqual(document);
    const released = run(ticked.document, "preset.aim.release", {
      presetId: "table",
      elements: ["left/root"],
    });
    expect(released.document.presets.table).toMatchObject({
      rows: { "left/root": {} },
    });
  });

  it("refuses a row on an Element the Preset does not list", () => {
    expect(
      refused(withTable(), "preset.elements.remove", {
        presetId: "table",
        refs: ["nope/root"],
      }),
    ).toBe("“nope/root” is not an Element of “Table”.");
    const document = run(withTable(), "preset.elements.remove", {
      presetId: "table",
      refs: ["right/root"],
    }).document;
    expect(document.presets.table).toMatchObject({
      elements: ["left/root"],
      rows: { "left/root": { pan: { value: 10 } } },
    });
    expect(document.presets.table).not.toHaveProperty(["rows", "right/root"]);
    expect(
      refused(document, "preset.row.set", {
        presetId: "table",
        elements: ["right/root"],
        attribute: "pan",
      }),
    ).toBe("“Right” is not an Element of “Table”.");
  });

  it("names its rows as Addresses, held to the Element's own range", () => {
    const document = withTable();
    expect(
      resolveAddress(document, "preset/table/row/left/root/tilt"),
    ).toMatchObject({
      label: "Tilt",
      owner: "Table · Left",
      path: ["presets", "table", "rows", "left/root", "tilt", "value"],
      type: "number",
      range: { min: -90, max: 90 },
    });
    expect(
      resolveAddress(document, "preset/table/row/all/color"),
    ).toMatchObject({ owner: "Table · All Elements", type: "color" });
    expect(
      listAddresses(document)
        .map((resolved) => resolved.address)
        .filter((address) => address.startsWith("preset/table/row/right")),
    ).toContain("preset/table/row/right/root/pan");
    expect(
      addressReach(document, "preset/table/row/all/tilt").map(
        (range) => range.label,
      ),
    ).toEqual(["Left", "Right"]);
    const clamped = run(document, "aim.edit", {
      pan: "preset/table/row/left/root/pan",
      tilt: "preset/table/row/left/root/tilt",
      value: { tilt: 120 },
    });
    expect(clamped.document.presets.table).toMatchObject({
      rows: { "left/root": { tilt: { value: 90 } } },
    });
    expect(clamped.warnings).toHaveLength(1);
  });

  it("writes a released row whole, so undoing the write releases it again", () => {
    const document = withTable();
    const written = run(document, "aim.edit", {
      pan: "preset/table/row/all/pan",
      tilt: "preset/table/row/all/tilt",
      value: { pan: 5 },
    });
    expect(written.document.presets.table).toMatchObject({
      all: { pan: { value: 5 } },
    });
    expect(applyPatches(written.document, written.inverse)).toEqual(document);
    const row = run(document, "address.edit", {
      address: "layer/spot/row/all/dimmer",
      value: 0.5,
    });
    expect(applyPatches(row.document, row.inverse)).toEqual(document);
  });

  it("writes both axes of an Aim on rows that were released", () => {
    const written = run(withTable(), "aim.edit", {
      pan: "layer/spot/row/set:movers/pan",
      tilt: "layer/spot/row/set:movers/tilt",
      value: { pan: 90, tilt: 5 },
    });
    expect(written.document.layers.spot).toMatchObject({
      rows: { "set:movers": { pan: { value: 90 }, tilt: { value: 5 } } },
    });
  });

  it("takes a Controller on a row, and refuses the hand edit while it does", () => {
    let document = withTable();
    document = run(document, "controller.create", {
      id: "sweep",
      kind: "number",
      name: "Sweep",
      addresses: ["preset/table/row/left/root/pan"],
    }).document;
    expect(
      refused(document, "preset.row.set", {
        presetId: "table",
        elements: ["left/root"],
        attribute: "pan",
        value: 5,
      }),
    ).toBe("Pan is controlled by Sweep.");
  });

  it("loses the entries of a Fixture that goes, with a warning", () => {
    const document = withTable();
    const removed = run(document, "fixture.remove", {
      fixtureId: "right",
    });
    expect(removed.document.presets.table).toMatchObject({
      elements: ["left/root"],
    });
    expect(removed.document.presets.table).not.toHaveProperty([
      "rows",
      "right/root",
    ]);
    expect(removed.warnings).toContain("Removed 1 Preset Element");
    expect(applyPatches(removed.document, removed.inverse)).toEqual(document);
  });
});
